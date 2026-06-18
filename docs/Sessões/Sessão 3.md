# Prompt de continuação — CannibalScan, Slice 3

> Cole o bloco abaixo (a partir de "CONTEXTO") num chat novo do Claude Code.
> Ele é autossuficiente: a sessão fria não precisa re-descobrir nada dos Slices 1 e 2.

---

## CONTEXTO

Estou continuando o projeto **CannibalScan** (`C:\dev\cannibalscan`) — um auditor de
canibalização de conteúdo de SEO que roda **no browser**: usuário arrasta um CSV de
crawl, o trabalho pesado (parsing + similaridade) acontece em **Rust compilado pra
WebAssembly**, e agora um agente **Mastra** gera a auditoria priorizada. É um projeto de
**aprendizado** da stack Rust(WASM)+Mastra. Idioma das respostas: **português**;
código/commits em inglês.

**Leia primeiro estes 2 arquivos** (são a fonte de verdade):
- Spec/design: `C:\dev\cannibalscan\docs\superpowers\Spec\um-amigo-meu-me-playful-kazoo.md`
  (arquitetura das 3 unidades, fronteiras/contratos, e a seção "Slices" que define o Slice 3)
- Plano do Slice 2 (padrão a seguir): `C:\Users\jeanz\.claude\plans\breezy-whistling-twilight.md`

### O que JÁ está pronto (Slices 1 e 2 — COMPLETOS e verificados E2E no browser)
Crate `wasm-core` (Rust puro testável + wrapper wasm-bindgen fino) + app `web` (Next 16).

**Slice 1 — parsing:**
- `wasm-core/src/types.rs` — `struct Page { url, title, meta, h1, text, word_count }` e
  `struct Corpus { pages, total_rows, skipped_rows }` (derivam serde).
- `wasm-core/src/parser.rs` — `parse_corpus(&[u8]) -> Result<Corpus, ParseError>` (CSV,
  detecção de coluna case-insensitive, dedup por URL). 6 testes nativos.
- `web/src/app/page.tsx` — drag-drop de CSV → tabela do corpus.

**Slice 2 — similaridade/canibalização:**
- `wasm-core/src/types.rs` — `struct OverlapPair { a, b, score }` (a/b = urls) e
  `struct OverlapReport { pairs: Vec<OverlapPair>, compared }` (derivam serde).
- `wasm-core/src/overlaps.rs` — `find_overlaps(&Corpus, threshold) -> OverlapReport`:
  TF-IDF + cosseno O(n²). Campos **ponderados** (title×3, h1×2, meta×1, text×1) e **IDF
  suavizado** `ln((n+1)/(df+1))+1`. 5 testes nativos em `tests/overlaps_test.rs`.
- `wasm-core/src/lib.rs` — bindings `#[wasm_bindgen] parse_corpus_json(&[u8])` e
  `find_overlaps_json(csv_bytes: &[u8], threshold: f64) -> Result<JsValue, JsValue>`.
- `web/src/lib/types.ts` — espelho TS de `Page`/`Corpus`/`OverlapPair`/`OverlapReport`.
- `web/src/lib/wasm.ts` — `parseCsv(bytes)` e `findOverlaps(bytes, threshold)` (reusam `init()`).
- `web/src/app/page.tsx` — slider de similaridade (default 0.7) + lista de pares
  `score · url A ↔ url B` ordenada, recalculando ao vivo. `data-testid`: `summary`,
  `overlaps`, `overlaps-summary`, `overlap-row`, `threshold`.
- CSV de exemplo: `C:\dev\cannibalscan\sample.csv` (2 páginas canibalizando + 1 díspar).
- 8 commits na branch `main` (últimos 4 do Slice 2: `1c81296`, `bb22e32`, `81f6a80`, `7787df3`).
  (Repo é local, **sem remote** — não tem `git push`, a menos que eu peça pra criar GitHub.)

### PEGADINHAS DE AMBIENTE — leia ou vai perder tempo
1. **PATH:** `cargo`/`wasm-pack` NÃO estão no PATH de shells novos. Prefixe:
   `$env:PATH = "$(Join-Path $env:USERPROFILE '.cargo\bin');$env:PATH"` (PS) ou
   `export PATH="$HOME/.cargo/bin:$PATH"` (bash).
2. **Toolchain GNU** é o default; target `wasm32-unknown-unknown` + `wasm-pack 0.13.1`
   instalados. NÃO troque pra MSVC (não tem VS Build Tools).
3. **`wasm-bindgen-test` escopado ao wasm32** no `Cargo.toml` e testes wasm com
   `#![cfg(target_arch="wasm32")]` no topo. MANTENHA — senão `cargo test` nativo quebra.
4. **O app `web` usa `npm`, NÃO pnpm.** Não reintroduza pnpm.
5. **Pkg WASM vive em `web/src/wasm/`** (build output, **gitignored**). Depois de QUALQUER
   mudança no Rust, regenere de `C:\dev\cannibalscan`:
   `wasm-pack build wasm-core --target web --out-dir ../web/src/wasm`. No TS importa via
   `@/wasm/cannibalscan_wasm_core.js`.
6. **NOVO no Slice 3 — segredo do LLM:** a key NUNCA vai pro browser nem pro git. Vive em
   `web/.env.local` (gitignored) e só é lida no servidor (Route Handler / Mastra).
   Debug de API: **checar env vars primeiro** (.env.local existe? nome da var bate com o
   código? sem aspas/caracteres especiais?) antes de mexer no código.

### Como verificar (gates reais)
```sh
# de C:\dev\cannibalscan (com cargo no PATH — ver pegadinha 1)
cd wasm-core && cargo test              # nativos do core (parser 6 + overlaps 5)
wasm-pack test --node                   # testes no alvo wasm32 (3 smokes)
cd .. && wasm-pack build wasm-core --target web --out-dir ../web/src/wasm
cd web && npm run dev                    # http://localhost:3000
```
Pra E2E no browser uso o MCP do Playwright (navegar, injetar um CSV no `input[type=file]`
via `DataTransfer`+evento `change`, ler os `data-testid`).
**NOVO p/ Slice 3:** testar o agente Mastra com um `OverlapReport`-fixture (sem rede, ou
mock do LLM) e assertar o **shape** das recomendações; eval de qualidade em 1–2 casos golden.

---

## TAREFA DESTA SESSÃO: Slice 3 — Agente Mastra (auditoria priorizada)

Objetivo: fechar o fluxo do produto. Depois que a UI mostra os pares canibalizando
(grátis, client-side), um botão **"Explicar/recomendar"** manda **só o `OverlapReport`**
(payload pequeno) a um agente **Mastra** que roda no servidor (escondendo a key) e devolve
uma **auditoria priorizada**: por par/cluster — qual URL manter como canônica, qual
fundir/redirecionar, título/meta consolidados sugeridos, e ordem de prioridade.

Fronteira (contrato, do spec): **web ↔ Mastra: `OverlapReport` (in) → `Recommendations` (out)**.
A parte grátis (Slices 1+2) já funciona sem o agente — **degradação graciosa**: se o LLM
estiver fora / sem key, a UI continua mostrando os pares crus.

Antes de codar, faça um mini-brainstorm comigo (2-3 perguntas) sobre as decisões:
1. **Onde o agente vive:** Route Handler do Next dentro de `web`
   (`web/src/app/api/audit/route.ts`, esconde a key, um deploy só) **vs.** pacote `agent`
   Mastra separado com server próprio. (Spec descreve "API route Node"; o caminho mais
   simples e didático é embutir no Next, mas quero entender o Mastra dev server.)
2. **Provider/modelo do LLM:** Groq (rápido/barato), Anthropic Haiku, ou OpenRouter — qual
   tenho key? (Spec sugere modelo barato Groq/Haiku.)
3. **Shape do `Recommendations`** (contrato de saída tipado): campos por item — ex.
   `{ keep, merge_or_redirect[], consolidated_title, consolidated_meta, priority, rationale }`.

### Esboço técnico sugerido (ajuste no brainstorm)
- **Contrato TS compartilhado** `web/src/lib/types.ts`: adicionar `Recommendation` /
  `AuditReport` (espelho do que o agente devolve). Manter o `OverlapReport` como input.
- **Agente Mastra** (1 agente + 1 tool): recebe o `OverlapReport` (top-N pares), faz 1
  chamada ao LLM com um prompt que pede a auditoria estruturada (saída validada por schema,
  ex. zod). Testável com fixture sem rede (mock do modelo) — assertar shape.
- **Route Handler** `web/src/app/api/audit/route.ts` (server-only): lê a key de
  `process.env`, invoca o agente, retorna `AuditReport` JSON. Trata erro do LLM devolvendo
  status claro pra UI cair na degradação graciosa.
- **UI** `web/src/app/page.tsx`: botão "Explicar/recomendar" (visível quando há pares) →
  `fetch('/api/audit', { OverlapReport })` → renderiza a auditoria por par
  (canônica/fundir/título/meta/prioridade). `data-testid` pra E2E (ex. `audit`, `audit-row`).
- **Env:** `web/.env.local` (gitignored) com a key; documentar o nome da var no README ou
  num `.env.example`.

### Disciplina (regras do usuário)
- **TDD**: teste falhando → mínimo pra passar → commit. Para o agente, o teste é o eval de
  shape/golden com fixture (sem depender de rede). Commits frequentes em inglês,
  terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Uma feature/slice por sessão** — este é o ÚLTIMO slice do v1. Não inventar escopo
  fora do spec (multi-site, contas, histórico, crawler = YAGNI).
- Respostas concisas; agir > analisar quando a tarefa é clara; **env vars primeiro** ao debugar.
- Ao terminar, atualizar a memória do projeto (`project-cannibalscan` em
  `C:\Users\jeanz\.claude\projects\c--dev-cannibalscan\memory\`) com o status do Slice 3.
