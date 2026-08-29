// ponytail: script one-shot de extração OCR→CSV, não vira feature do produto.
// Lê fotos de sacolas/embalagens de lojas, extrai {empresa, contato} via Gemini
// (vision, OpenRouter) e monta uma planilha de prospecção. Reusa a key do web/.env.local.
//
//   node web/scripts/extract-leads.mjs "C:\Users\jeanz\OneDrive\Desktop\Desespero"
//   node web/scripts/extract-leads.mjs --selftest   # checa a lógica pura, sem API
//
// Resiliente: grava checkpoint em _leads.jsonl conforme processa. Se cair no meio,
// rode de novo — pula o que já leu (não paga de novo). No fim gera leads-bruto.csv
// (1 linha por leitura) e leads-dedup.csv (1 por empresa, agrupado por telefone).

import { readFile, readdir, appendFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";

const HERE = dirname(fileURLToPath(import.meta.url));
const MODEL = process.env.AUDIT_MODEL || "google/gemini-2.5-flash";
const CONCURRENCY = 6;
const IMG_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// --- lógica pura (testável no --selftest) --------------------------------

// DDD brasileiro -> UF. Um DDD cobre várias cidades, então damos só a UF.
const DDD_UF = {
  11: "SP", 12: "SP", 13: "SP", 14: "SP", 15: "SP", 16: "SP", 17: "SP", 18: "SP", 19: "SP",
  21: "RJ", 22: "RJ", 24: "RJ", 27: "ES", 28: "ES",
  31: "MG", 32: "MG", 33: "MG", 34: "MG", 35: "MG", 37: "MG", 38: "MG",
  41: "PR", 42: "PR", 43: "PR", 44: "PR", 45: "PR", 46: "PR",
  47: "SC", 48: "SC", 49: "SC", 51: "RS", 53: "RS", 54: "RS", 55: "RS",
  61: "DF", 62: "GO", 64: "GO", 63: "TO", 65: "MT", 66: "MT", 67: "MS",
  68: "AC", 69: "RO", 71: "BA", 73: "BA", 74: "BA", 75: "BA", 77: "BA", 79: "SE",
  81: "PE", 87: "PE", 82: "AL", 83: "PB", 84: "RN", 85: "CE", 88: "CE", 86: "PI", 89: "PI",
  91: "PA", 93: "PA", 94: "PA", 92: "AM", 97: "AM", 95: "RR", 96: "AP", 98: "MA", 99: "MA",
};

/** Só os dígitos de um telefone, sem o 55 do país. */
export function phoneDigits(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/** UF a partir do DDD do primeiro telefone/whatsapp que tiver 10-11 dígitos. */
export function ufFromPhones(...phones) {
  for (const p of phones) {
    const d = phoneDigits(p);
    if (d.length === 10 || d.length === 11) {
      const uf = DDD_UF[Number(d.slice(0, 2))];
      if (uf) return uf;
    }
  }
  return "";
}

/** Chave de dedupe: telefone normalizado se houver, senão nome da empresa. */
export function dedupeKey(row) {
  const d = phoneDigits(row.whatsapp) || phoneDigits(row.telefone);
  if (d.length >= 10) return "tel:" + d;
  return "nome:" + String(row.empresa || "").toLowerCase().replace(/\s+/g, " ").trim();
}

const CONF_RANK = { alta: 3, media: 2, baixa: 1 };

/** Agrupa leituras por empresa/telefone; mantém a de maior confiança e conta fotos. */
export function dedupe(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = dedupeKey(r);
    const g = groups.get(k);
    if (!g) {
      groups.set(k, { ...r, qtd_fotos: 1, arquivos: r.arquivo || "" });
    } else {
      g.qtd_fotos += 1;
      if (r.arquivo && !g.arquivos.includes(r.arquivo)) g.arquivos += "; " + r.arquivo;
      if ((CONF_RANK[r.confianca] || 0) > (CONF_RANK[g.confianca] || 0)) {
        // promove os campos da leitura mais confiável, preservando contagem
        Object.assign(g, r, { qtd_fotos: g.qtd_fotos, arquivos: g.arquivos });
      }
    }
  }
  return [...groups.values()].sort(
    (a, b) => (CONF_RANK[b.confianca] || 0) - (CONF_RANK[a.confianca] || 0),
  );
}

/** Escapa um campo CSV por RFC-4180. */
function esc(v) {
  const s = String(v ?? "").replace(/\r\n/g, "\n");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(headers, rows) {
  const head = headers.join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return "﻿" + [head, ...lines].join("\r\n") + "\r\n"; // BOM p/ Excel abrir acentos
}

// --- extração via Gemini -------------------------------------------------

const PROMPT = `Você está lendo a FOTO de uma sacola ou embalagem de papel de uma loja (ferragens, ferramentas, etc).
Extraia as EMPRESAS visíveis e seus contatos. Pode haver MAIS DE UMA empresa/marca na mesma foto.
Ignore texto genérico de embalagem (ex: "esta fita é sua garantia", "confira a mercadoria").
Se a foto estiver borrada ou ilegível, marque confianca "baixa" e explique em observacao.

Responda SOMENTE com JSON neste formato:
{"empresas":[{
  "empresa":"nome da loja/marca",
  "ramo":"ramo se der pra inferir (ex: ferragens, ferramentas)",
  "telefone":"fixo com DDD, só dígitos, ou vazio",
  "whatsapp":"celular/whatsapp com DDD, só dígitos, ou vazio",
  "email":"", "instagram":"@ se houver", "endereco":"", "cnpj":"",
  "confianca":"alta|media|baixa",
  "observacao":"o que mais leu ou por que a confiança é baixa"
}]}
Se não houver nenhuma empresa legível, retorne {"empresas":[]}.`;

const FIELDS = ["empresa", "ramo", "telefone", "whatsapp", "email", "instagram", "endereco", "cnpj", "confianca", "observacao"];

function coerce(e) {
  const o = {};
  for (const f of FIELDS) o[f] = typeof e?.[f] === "string" ? e[f].trim() : "";
  if (!CONF_RANK[o.confianca]) o.confianca = "baixa";
  return o;
}

/** Parse defensivo: modelo às vezes embrulha o JSON em texto/```json. */
function parseEmpresas(content) {
  let txt = String(content || "").trim();
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) txt = fence[1].trim();
  try {
    return JSON.parse(txt).empresas ?? [];
  } catch {
    const s = txt.indexOf("{"), end = txt.lastIndexOf("}");
    if (s >= 0 && end > s) {
      try { return JSON.parse(txt.slice(s, end + 1)).empresas ?? []; } catch { /* cai fora */ }
    }
    throw new Error("resposta não-JSON: " + txt.slice(0, 120));
  }
}

async function callGemini(apiKey, dataUrl) {
  const body = {
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{
      role: "user",
      content: [
        { type: "text", text: PROMPT },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    }],
  };
  // retry com backoff — 429/5xx são transitórios; não queremos perder a imagem.
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) { lastErr = new Error("HTTP " + res.status); continue; }
      if (!res.ok) throw new Error("HTTP " + res.status + " " + (await res.text()).slice(0, 200));
      const json = await res.json();
      return parseEmpresas(json.choices?.[0]?.message?.content);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function toDataUrl(file) {
  const buf = await readFile(file);
  const ext = extname(file).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// --- main ----------------------------------------------------------------

async function main() {
  const dir = process.argv[2];
  if (!dir) { console.error("uso: node extract-leads.mjs <pasta-de-imagens>"); process.exit(1); }

  const envPath = join(HERE, "..", ".env.local");
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) { console.error("OPENROUTER_API_KEY ausente em web/.env.local"); process.exit(1); }

  const files = (await readdir(dir))
    .filter((f) => IMG_EXT.has(extname(f).toLowerCase()))
    .sort();
  const checkpoint = join(dir, "_leads.jsonl");

  // já processados (sem erro) — pra retomar sem repagar
  const done = new Set();
  if (existsSync(checkpoint)) {
    for (const line of (await readFile(checkpoint, "utf8")).split("\n")) {
      if (!line.trim()) continue;
      try { const r = JSON.parse(line); if (!r.erro) done.add(r.arquivo); } catch { /* linha corrompida, ignora */ }
    }
  }

  const todo = files.filter((f) => !done.has(f));
  console.log(`${files.length} imagens · ${done.size} já feitas · ${todo.length} a processar (modelo ${MODEL})`);

  const limit = pLimit(CONCURRENCY);
  let ok = 0, fail = 0;
  await Promise.all(todo.map((f) => limit(async () => {
    try {
      const empresas = await callGemini(apiKey, await toDataUrl(join(dir, f)));
      await appendFile(checkpoint, JSON.stringify({ arquivo: f, empresas }) + "\n");
      ok++;
    } catch (e) {
      await appendFile(checkpoint, JSON.stringify({ arquivo: f, erro: String(e.message || e) }) + "\n");
      fail++;
    }
    if ((ok + fail) % 25 === 0) console.log(`  ...${ok + fail}/${todo.length} (ok ${ok}, erro ${fail})`);
  })));
  console.log(`extração: ${ok} ok, ${fail} com erro`);

  // achata o checkpoint todo -> linhas -> CSVs
  const raw = [];
  for (const line of (await readFile(checkpoint, "utf8")).split("\n")) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    for (const e of r.empresas || []) {
      const row = { arquivo: r.arquivo, ...coerce(e) };
      row.cidade_uf = ufFromPhones(row.whatsapp, row.telefone);
      raw.push(row);
    }
  }

  const brutoHeaders = ["arquivo", "empresa", "ramo", "telefone", "whatsapp", "cidade_uf", "email", "instagram", "endereco", "cnpj", "confianca", "observacao"];
  const dedupHeaders = ["empresa", "ramo", "telefone", "whatsapp", "cidade_uf", "email", "instagram", "endereco", "cnpj", "confianca", "qtd_fotos", "arquivos", "observacao"];
  await writeFile(join(dir, "leads-bruto.csv"), toCsv(brutoHeaders, raw));
  await writeFile(join(dir, "leads-dedup.csv"), toCsv(dedupHeaders, dedupe(raw)));
  console.log(`pronto: ${raw.length} leituras -> leads-bruto.csv · ${dedupe(raw).length} empresas únicas -> leads-dedup.csv (em ${dir})`);
}

// --- self-check (roda sem API) ------------------------------------------

function selftest() {
  const assert = (c, m) => { if (!c) throw new Error("FALHOU: " + m); };
  assert(phoneDigits("(62) 99165-8016") === "62991658016", "phoneDigits limpa");
  assert(phoneDigits("+55 64 3621-4990") === "6436214990", "phoneDigits tira 55");
  assert(ufFromPhones("", "(62) 99165-8016") === "GO", "DDD 62 -> GO");
  assert(ufFromPhones("11 98888-7777") === "SP", "DDD 11 -> SP");
  assert(ufFromPhones("123") === "", "telefone curto -> sem UF");
  assert(dedupeKey({ whatsapp: "(62) 99165-8016" }) === "tel:62991658016", "chave por telefone");
  assert(dedupeKey({ empresa: "A Ferragista" }) === "nome:a ferragista", "chave por nome");
  const d = dedupe([
    { empresa: "af", whatsapp: "62991658016", confianca: "baixa", arquivo: "1.jpg", observacao: "borrada" },
    { empresa: "aferragista", whatsapp: "(62) 99165-8016", confianca: "alta", arquivo: "2.jpg", observacao: "" },
  ]);
  assert(d.length === 1, "mesma loja em 2 fotos -> 1 linha");
  assert(d[0].empresa === "aferragista" && d[0].qtd_fotos === 2, "mantém a de maior confiança e conta 2 fotos");
  assert(toCsv(["a"], [{ a: 'x,"y"' }]).includes('"x,""y"""'), "CSV escapa vírgula e aspas");
  console.log("selftest OK");
}

if (process.argv.includes("--selftest")) selftest();
else main().catch((e) => { console.error(e); process.exit(1); });
