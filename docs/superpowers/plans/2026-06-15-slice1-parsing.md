# CannibalScan — Slice 1 (Esqueleto + Parsing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página Next.js onde o usuário arrasta um CSV de crawl, um core Rust compilado pra WASM parseia o arquivo, e a UI mostra uma tabela do corpus parseado (url, título, contagem de palavras) + um resumo (linhas totais / puladas).

**Architecture:** Monorepo em `C:\dev\cannibalscan` com duas unidades. `wasm-core` = crate Rust com lógica de parsing PURA (testável com `cargo test` nativo, rápido) atrás de um wrapper `wasm-bindgen` bem fino. `web` = app Next.js que só faz UI (drop de arquivo, render) e chama o WASM através de um wrapper TypeScript tipado. A fronteira entre os dois é o shape JSON de `Corpus`.

**Tech Stack:** Rust (stable, toolchain GNU no Windows pra evitar VS Build Tools), `wasm-bindgen` + `wasm-pack`, crates `csv` / `serde` / `serde-wasm-bindgen`; Next.js (App Router, TS, Tailwind), pnpm.

---

## Estrutura de arquivos (locked-in)

```
C:\dev\cannibalscan\
  wasm-core\
    Cargo.toml
    src\
      lib.rs            # edge: pub mods + wrapper wasm-bindgen parse_corpus_json
      types.rs          # struct Page, struct Corpus (serde)
      parser.rs         # parse_corpus(&[u8]) -> Result<Corpus, ParseError>  (PURO)
    tests\
      parser_test.rs    # testes de integração nativos do parser
      wasm_test.rs      # smoke test do binding via wasm-bindgen-test (node)
  web\                  # criado na Task 7 via create-next-app
    next.config.mjs     # habilita asyncWebAssembly
    src\lib\types.ts    # espelho TS de Corpus/Page
    src\lib\wasm.ts     # wrapper async tipado que importa o pkg WASM
    src\app\page.tsx    # client component: drop zone + tabela
  docs\superpowers\plans\2026-06-15-slice1-parsing.md   # este arquivo
```

**Princípio de fronteira:** `parser.rs` não conhece WASM nem JS — é Rust puro, testável com `cargo test`. `lib.rs` só traduz `Corpus` ↔ `JsValue`. `web` não tem lógica de negócio.

---

## Task 1: Toolchain Rust + scaffold do crate

**Files:**
- Create: `C:\dev\cannibalscan\wasm-core\Cargo.toml`
- Create: `C:\dev\cannibalscan\.gitignore`

- [ ] **Step 1: Instalar o toolchain Rust (GNU — não exige Visual Studio Build Tools)**

Run (PowerShell):
```powershell
winget install --id Rustlang.Rustup -e --source winget
```
Feche e reabra o terminal pra carregar o PATH. Depois:
```powershell
rustup toolchain install stable-x86_64-pc-windows-gnu
rustup default stable-x86_64-pc-windows-gnu
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```
Expected: `rustc --version`, `cargo --version` e `wasm-pack --version` todos respondem.

- [ ] **Step 2: Criar o repo e o crate**

Run:
```powershell
cd C:\dev\cannibalscan
git init
cargo new --lib wasm-core
```
Expected: cria `wasm-core/Cargo.toml` e `wasm-core/src/lib.rs`.

- [ ] **Step 3: Escrever o Cargo.toml**

Substitua o conteúdo de `C:\dev\cannibalscan\wasm-core\Cargo.toml` por:
```toml
[package]
name = "cannibalscan-wasm-core"
version = "0.1.0"
edition = "2021"

[lib]
# cdylib = alvo WASM; rlib = permite que os testes nativos usem a lib
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
serde = { version = "1", features = ["derive"] }
serde-wasm-bindgen = "0.6"
csv = "1.3"

[dev-dependencies]
wasm-bindgen-test = "0.3"
```

- [ ] **Step 4: Escrever o .gitignore da raiz**

Create `C:\dev\cannibalscan\.gitignore`:
```gitignore
# Rust
/wasm-core/target
/wasm-core/pkg
# Node / Next
/web/node_modules
/web/.next
/web/out
# OS
Thumbs.db
.DS_Store
```

- [ ] **Step 5: Verificar build e commitar**

Run:
```powershell
cd C:\dev\cannibalscan\wasm-core
cargo build
```
Expected: compila (baixa as deps na 1ª vez). Depois:
```powershell
cd C:\dev\cannibalscan
git add -A
git commit -m "chore: scaffold cannibalscan wasm-core crate"
```

---

## Task 2: Parser — caminho feliz (url + título + texto)

**Files:**
- Create: `C:\dev\cannibalscan\wasm-core\src\types.rs`
- Create: `C:\dev\cannibalscan\wasm-core\src\parser.rs`
- Modify: `C:\dev\cannibalscan\wasm-core\src\lib.rs`
- Test: `C:\dev\cannibalscan\wasm-core\tests\parser_test.rs`

- [ ] **Step 1: Escrever o teste que falha**

Create `wasm-core/tests/parser_test.rs`:
```rust
use cannibalscan_wasm_core::parser::parse_corpus;

#[test]
fn parses_minimal_screaming_frog_csv() {
    let csv = "Address,Title 1,Content\n\
               https://a.com,Page A,hello world foo\n\
               https://b.com,Page B,bar baz\n";
    let corpus = parse_corpus(csv.as_bytes()).unwrap();
    assert_eq!(corpus.pages.len(), 2);
    assert_eq!(corpus.pages[0].url, "https://a.com");
    assert_eq!(corpus.pages[0].title, "Page A");
    assert_eq!(corpus.pages[0].text, "hello world foo");
    assert_eq!(corpus.pages[0].word_count, 3);
    assert_eq!(corpus.total_rows, 2);
}
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd C:\dev\cannibalscan\wasm-core; cargo test --test parser_test`
Expected: FAIL — não compila (`parser`, `parse_corpus`, `Corpus` não existem).

- [ ] **Step 3: Escrever os tipos**

Create `wasm-core/src/types.rs`:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Page {
    pub url: String,
    pub title: String,
    pub meta: String,
    pub h1: String,
    pub text: String,
    pub word_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Corpus {
    pub pages: Vec<Page>,
    pub total_rows: usize,
    pub skipped_rows: usize,
}
```

- [ ] **Step 4: Escrever o parser mínimo**

Create `wasm-core/src/parser.rs`:
```rust
use crate::types::{Corpus, Page};

const URL_HEADERS: &[&str] = &["address", "url"];
const TITLE_HEADERS: &[&str] = &["title 1", "title"];
const TEXT_HEADERS: &[&str] = &["content", "text", "body"];

fn find_col(headers: &csv::StringRecord, candidates: &[&str]) -> Option<usize> {
    for (i, h) in headers.iter().enumerate() {
        if candidates.contains(&h.trim().to_lowercase().as_str()) {
            return Some(i);
        }
    }
    None
}

fn field(rec: &csv::StringRecord, idx: Option<usize>) -> String {
    idx.and_then(|i| rec.get(i)).unwrap_or("").trim().to_string()
}

pub fn parse_corpus(csv_bytes: &[u8]) -> Corpus {
    let mut rdr = csv::ReaderBuilder::new().flexible(true).from_reader(csv_bytes);
    let headers = rdr.headers().expect("headers").clone();

    let url_idx = find_col(&headers, URL_HEADERS);
    let title_idx = find_col(&headers, TITLE_HEADERS);
    let text_idx = find_col(&headers, TEXT_HEADERS);

    let mut pages = Vec::new();
    let mut total = 0usize;

    for result in rdr.records() {
        total += 1;
        let rec = result.expect("record");
        let text = field(&rec, text_idx);
        let word_count = text.split_whitespace().count();
        pages.push(Page {
            url: field(&rec, url_idx),
            title: field(&rec, title_idx),
            meta: String::new(),
            h1: String::new(),
            text,
            word_count,
        });
    }

    Corpus { pages, total_rows: total, skipped_rows: 0 }
}
```

NOTA: nesta task `parse_corpus` retorna `Corpus` direto (sem `Result`). Vira `Result` na Task 4. O teste da Task 2 usa `.unwrap()` — então ajuste: por ora o teste deve chamar `parse_corpus(...)` sem `.unwrap()`. **Corrija o Step 1**: troque `let corpus = parse_corpus(csv.as_bytes()).unwrap();` por `let corpus = parse_corpus(csv.as_bytes());`. (O `.unwrap()` volta na Task 4 junto com o `Result`.)

- [ ] **Step 5: Declarar os módulos em lib.rs**

Replace o conteúdo de `wasm-core/src/lib.rs` por:
```rust
pub mod parser;
pub mod types;
```

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `cargo test --test parser_test`
Expected: PASS (1 teste).

- [ ] **Step 7: Commit**

```powershell
cd C:\dev\cannibalscan
git add -A
git commit -m "feat(wasm-core): parse minimal crawl CSV into Corpus"
```

---

## Task 3: Detecção de colunas robusta (meta, h1, ordem qualquer)

**Files:**
- Modify: `C:\dev\cannibalscan\wasm-core\src\parser.rs`
- Test: `C:\dev\cannibalscan\wasm-core\tests\parser_test.rs`

- [ ] **Step 1: Adicionar o teste que falha**

Append em `wasm-core/tests/parser_test.rs`:
```rust
#[test]
fn detects_alternate_headers_any_order() {
    let csv = "url,body,meta description,h1,title\n\
               https://x.com,one two,desc here,Heading,Title X\n";
    let corpus = parse_corpus(csv.as_bytes());
    let p = &corpus.pages[0];
    assert_eq!(p.url, "https://x.com");
    assert_eq!(p.text, "one two");
    assert_eq!(p.meta, "desc here");
    assert_eq!(p.h1, "Heading");
    assert_eq!(p.title, "Title X");
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --test parser_test`
Expected: FAIL no `detects_alternate_headers_any_order` (meta e h1 vêm vazios).

- [ ] **Step 3: Adicionar candidatos meta/h1 e popular os campos**

Em `wasm-core/src/parser.rs`, adicione abaixo das outras constantes:
```rust
const META_HEADERS: &[&str] = &["meta description 1", "meta description", "meta"];
const H1_HEADERS: &[&str] = &["h1-1", "h1"];
```
Dentro de `parse_corpus`, após `let text_idx = ...;`:
```rust
    let meta_idx = find_col(&headers, META_HEADERS);
    let h1_idx = find_col(&headers, H1_HEADERS);
```
E no `Page { ... }`, troque as duas linhas vazias por:
```rust
            meta: field(&rec, meta_idx),
            h1: field(&rec, h1_idx),
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test --test parser_test`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(wasm-core): detect meta/h1 and headers in any order"
```

---

## Task 4: Erros tipados (arquivo vazio, colunas obrigatórias ausentes)

**Files:**
- Modify: `C:\dev\cannibalscan\wasm-core\src\parser.rs`
- Test: `C:\dev\cannibalscan\wasm-core\tests\parser_test.rs`

- [ ] **Step 1: Adicionar os testes que falham**

Append em `wasm-core/tests/parser_test.rs`:
```rust
use cannibalscan_wasm_core::parser::ParseError;

#[test]
fn empty_file_errors() {
    assert_eq!(parse_corpus(b""), Err(ParseError::EmptyFile));
}

#[test]
fn missing_url_column_errors() {
    let csv = "Title 1,Content\nPage,hello\n";
    assert_eq!(parse_corpus(csv.as_bytes()), Err(ParseError::MissingUrlColumn));
}

#[test]
fn missing_text_column_errors() {
    let csv = "Address,Title 1\nhttps://a.com,Page A\n";
    assert_eq!(parse_corpus(csv.as_bytes()), Err(ParseError::MissingTextColumn));
}
```
Agora atualize os testes das Tasks 2 e 3 pra usar `.unwrap()` de novo (eles passam a receber `Result`):
- `let corpus = parse_corpus(csv.as_bytes());` → `let corpus = parse_corpus(csv.as_bytes()).unwrap();` (nos dois testes anteriores).

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --test parser_test`
Expected: FAIL — `ParseError` não existe e a assinatura não retorna `Result`.

- [ ] **Step 3: Adicionar ParseError e converter para Result**

Em `wasm-core/src/parser.rs`, adicione antes da fn:
```rust
#[derive(Debug, PartialEq)]
pub enum ParseError {
    EmptyFile,
    MissingUrlColumn,
    MissingTextColumn,
}
```
Troque a assinatura e o topo da função:
```rust
pub fn parse_corpus(csv_bytes: &[u8]) -> Result<Corpus, ParseError> {
    if csv_bytes.iter().all(|b| b.is_ascii_whitespace()) {
        return Err(ParseError::EmptyFile);
    }
    let mut rdr = csv::ReaderBuilder::new().flexible(true).from_reader(csv_bytes);
    let headers = match rdr.headers() {
        Ok(h) => h.clone(),
        Err(_) => return Err(ParseError::EmptyFile),
    };

    let url_idx = find_col(&headers, URL_HEADERS).ok_or(ParseError::MissingUrlColumn)?;
    let text_idx = find_col(&headers, TEXT_HEADERS).ok_or(ParseError::MissingTextColumn)?;
    let title_idx = find_col(&headers, TITLE_HEADERS);
    let meta_idx = find_col(&headers, META_HEADERS);
    let h1_idx = find_col(&headers, H1_HEADERS);
```
Como `url_idx`/`text_idx` agora são `usize` (não `Option`), troque os usos deles dentro do loop:
```rust
        let text = rec.get(text_idx).unwrap_or("").trim().to_string();
        // ...
            url: rec.get(url_idx).unwrap_or("").trim().to_string(),
```
E troque o `for result in rdr.records()` pra não dar panic em linha corrompida:
```rust
    for result in rdr.records() {
        total += 1;
        let rec = match result {
            Ok(r) => r,
            Err(_) => continue,
        };
```
Por fim, troque o retorno final:
```rust
    Ok(Corpus { pages, total_rows: total, skipped_rows: 0 })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test --test parser_test`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(wasm-core): typed ParseError for empty/missing-column inputs"
```

---

## Task 5: Dedup por URL + contagem de linhas puladas

**Files:**
- Modify: `C:\dev\cannibalscan\wasm-core\src\parser.rs`
- Test: `C:\dev\cannibalscan\wasm-core\tests\parser_test.rs`

- [ ] **Step 1: Adicionar o teste que falha**

Append em `wasm-core/tests/parser_test.rs`:
```rust
#[test]
fn dedups_urls_and_counts_skipped() {
    let csv = "Address,Content\n\
               https://a.com,one\n\
               https://a.com,dup\n\
               ,blank url row\n\
               https://b.com,two\n";
    let corpus = parse_corpus(csv.as_bytes()).unwrap();
    assert_eq!(corpus.pages.len(), 2);     // a.com (1ª) + b.com
    assert_eq!(corpus.total_rows, 4);
    assert_eq!(corpus.skipped_rows, 2);    // a.com duplicada + url em branco
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cargo test --test parser_test`
Expected: FAIL — hoje `skipped_rows` é sempre 0 e URLs duplicadas viram páginas.

- [ ] **Step 3: Implementar dedup + skipped**

Em `wasm-core/src/parser.rs`, dentro de `parse_corpus`, antes do loop:
```rust
    let mut pages = Vec::new();
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut total = 0usize;
    let mut skipped = 0usize;
```
Dentro do loop, logo após obter `rec`:
```rust
        let url = rec.get(url_idx).unwrap_or("").trim().to_string();
        if url.is_empty() || !seen.insert(url.clone()) {
            skipped += 1;
            continue;
        }
```
Use esse `url` no `Page { url, ... }` (remova a linha antiga `url: rec.get(...)`). Troque o retorno:
```rust
    Ok(Corpus { pages, total_rows: total, skipped_rows: skipped })
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cargo test --test parser_test`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```powershell
git add -A
git commit -m "feat(wasm-core): dedup by URL and count skipped rows"
```

---

## Task 6: Binding WASM + build com wasm-pack + smoke test

**Files:**
- Modify: `C:\dev\cannibalscan\wasm-core\src\lib.rs`
- Test: `C:\dev\cannibalscan\wasm-core\tests\wasm_test.rs`

- [ ] **Step 1: Escrever o smoke test do binding**

Create `wasm-core/tests/wasm_test.rs`:
```rust
use wasm_bindgen_test::*;
use cannibalscan_wasm_core::parse_corpus_json;

#[wasm_bindgen_test]
fn wasm_parse_returns_ok_for_valid_csv() {
    let csv = b"Address,Content\nhttps://a.com,hello world\n";
    assert!(parse_corpus_json(csv).is_ok());
}

#[wasm_bindgen_test]
fn wasm_parse_returns_err_for_missing_url() {
    let csv = b"Title 1,Content\nPage,hello\n";
    assert!(parse_corpus_json(csv).is_err());
}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `wasm-pack test --node`
Expected: FAIL — `parse_corpus_json` não existe.

- [ ] **Step 3: Adicionar o wrapper wasm-bindgen**

Replace o conteúdo de `wasm-core/src/lib.rs` por:
```rust
pub mod parser;
pub mod types;

use wasm_bindgen::prelude::*;

/// Edge fino WASM↔JS: parseia bytes de CSV e devolve o Corpus como objeto JS.
#[wasm_bindgen]
pub fn parse_corpus_json(csv_bytes: &[u8]) -> Result<JsValue, JsValue> {
    let corpus = parser::parse_corpus(csv_bytes)
        .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    serde_wasm_bindgen::to_value(&corpus).map_err(|e| JsValue::from_str(&e.to_string()))
}
```

- [ ] **Step 4: Rodar o smoke test e ver passar**

Run: `wasm-pack test --node`
Expected: PASS (2 testes wasm). Rode também `cargo test` pra garantir que os 6 testes nativos seguem verdes.

- [ ] **Step 5: Gerar o pacote pra consumo no Next**

Run (da raiz):
```powershell
cd C:\dev\cannibalscan
wasm-pack build wasm-core --target bundler --out-dir pkg
```
Expected: cria `wasm-core/pkg/` com `cannibalscan_wasm_core.js`, `.d.ts`, `_bg.wasm` e `package.json`.

- [ ] **Step 6: Commit**

```powershell
git add -A
git commit -m "feat(wasm-core): expose parse_corpus_json wasm-bindgen entrypoint"
```

---

## Task 7: App Next.js — drop de CSV → tabela (integração WASM)

> Esta é a task de MAIOR risco de integração (WASM dentro do bundler do Next). Valide o carregamento do WASM (Step 6) ANTES de polir a UI. Se o Turbopack reclamar do WASM, rode o dev em webpack (Step 5 cobre isso).

**Files:**
- Create: `C:\dev\cannibalscan\web\next.config.mjs`
- Create: `C:\dev\cannibalscan\web\src\lib\types.ts`
- Create: `C:\dev\cannibalscan\web\src\lib\wasm.ts`
- Modify: `C:\dev\cannibalscan\web\src\app\page.tsx`
- Modify: `C:\dev\cannibalscan\web\package.json`

- [ ] **Step 1: Criar o app Next**

Run (da raiz):
```powershell
cd C:\dev\cannibalscan
pnpm create next-app@latest web --ts --eslint --app --src-dir --tailwind --import-alias "@/*" --use-pnpm
```
Se aparecerem prompts interativos, aceite os defaults coerentes (App Router, TS, Tailwind, src dir). Expected: cria `web/` e instala deps.

- [ ] **Step 2: Adicionar o pacote WASM como dependência local**

Em `web/package.json`, adicione em `dependencies`:
```json
"cannibalscan-wasm-core": "file:../wasm-core/pkg"
```
Run:
```powershell
cd C:\dev\cannibalscan\web
pnpm install
```
Expected: linka `../wasm-core/pkg` em `node_modules`.

- [ ] **Step 3: Habilitar WASM no bundler**

Create/replace `web/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};
export default nextConfig;
```

- [ ] **Step 4: Espelhar os tipos e escrever o wrapper WASM**

Create `web/src/lib/types.ts`:
```ts
export interface Page {
  url: string;
  title: string;
  meta: string;
  h1: string;
  text: string;
  word_count: number;
}

export interface Corpus {
  pages: Page[];
  total_rows: number;
  skipped_rows: number;
}
```

Create `web/src/lib/wasm.ts`:
```ts
import type { Corpus } from "./types";

// Import dinâmico: o módulo WASM é instanciado de forma assíncrona pelo bundler.
export async function parseCsv(bytes: Uint8Array): Promise<Corpus> {
  const mod = await import("cannibalscan-wasm-core");
  return mod.parse_corpus_json(bytes) as Corpus;
}
```

- [ ] **Step 5: Garantir o dev em webpack (evita pegadinha de WASM no Turbopack)**

Em `web/package.json`, ajuste o script de dev pra NÃO usar turbopack:
```json
"dev": "next dev",
"build": "next build",
"start": "next start"
```
(Se o `create-next-app` tiver gerado `"dev": "next dev --turbopack"`, remova o `--turbopack`.)

- [ ] **Step 6: Verificar que o WASM carrega (gate antes da UI)**

Substitua `web/src/app/page.tsx` por uma versão de smoke test:
```tsx
"use client";
import { useEffect, useState } from "react";
import { parseCsv } from "@/lib/wasm";

export default function Home() {
  const [status, setStatus] = useState("carregando wasm...");
  useEffect(() => {
    const csv = new TextEncoder().encode("Address,Content\nhttps://a.com,hello world\n");
    parseCsv(csv)
      .then((c) => setStatus(`OK: ${c.pages.length} página(s), ${c.pages[0].word_count} palavras`))
      .catch((e) => setStatus(`ERRO: ${String(e)}`));
  }, []);
  return <main className="p-8 font-mono">{status}</main>;
}
```
Run: `cd C:\dev\cannibalscan\web; pnpm dev` e abra `http://localhost:3000`.
Expected: a página mostra `OK: 1 página(s), 2 palavras`. Se mostrar ERRO de WASM, resolva a integração ANTES de seguir (provável causa: bundler — confirme `asyncWebAssembly` e dev em webpack).

- [ ] **Step 7: Implementar a UI real (drop + tabela)**

Replace `web/src/app/page.tsx` por:
```tsx
"use client";
import { useState } from "react";
import { parseCsv } from "@/lib/wasm";
import type { Corpus } from "@/lib/types";

export default function Home() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setCorpus(await parseCsv(bytes));
    } catch (e) {
      setCorpus(null);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-4 text-2xl font-bold">CannibalScan — Slice 1</h1>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-400 p-10 text-center text-gray-600 hover:bg-gray-50"
      >
        Arraste um CSV de crawl aqui, ou clique pra escolher
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {busy && <p className="mt-4">Processando…</p>}
      {error && <p className="mt-4 text-red-600">Erro: {error}</p>}

      {corpus && (
        <section className="mt-6">
          <p className="mb-3 text-sm text-gray-700">
            {corpus.pages.length} páginas · {corpus.total_rows} linhas lidas ·{" "}
            {corpus.skipped_rows} puladas
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">URL</th>
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Palavras</th>
                </tr>
              </thead>
              <tbody>
                {corpus.pages.slice(0, 200).map((p) => (
                  <tr key={p.url} className="border-b">
                    <td className="py-1 pr-4 text-blue-700">{p.url}</td>
                    <td className="py-1 pr-4">{p.title}</td>
                    <td className="py-1 pr-4">{p.word_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
```

- [ ] **Step 8: Verificação E2E manual**

Crie um CSV de teste `C:\dev\cannibalscan\sample.csv`:
```csv
Address,Title 1,Content
https://a.com,Página A,um dois tres
https://b.com,Página B,quatro cinco
```
Run `pnpm dev`, abra `http://localhost:3000`, arraste `sample.csv`.
Expected: tabela com 2 linhas, "2 páginas · 2 linhas lidas · 0 puladas", contagens de palavras 3 e 2.

- [ ] **Step 9: Commit**

```powershell
cd C:\dev\cannibalscan
git add -A
git commit -m "feat(web): CSV drop UI rendering parsed corpus via WASM"
```

---

## Verificação final do Slice 1

- `cd wasm-core; cargo test` → 6 testes nativos verdes.
- `cd wasm-core; wasm-pack test --node` → 2 testes WASM verdes.
- `cd web; pnpm dev` → arrastar um CSV mostra a tabela parseada (E2E manual).
- (Opcional, valida a tese) Exportar um crawl grande (~50k linhas) do Screaming Frog e confirmar que o parse roda liso, sem travar a aba.

## Fora de escopo (fica pro Slice 2+)

- Similaridade / detecção de canibalização (`find_overlaps`) — Slice 2.
- Agente Mastra / recomendações — Slice 3.
- Streaming de arquivos enormes via Web Worker (se o parse na main thread incomodar com 50k+ linhas, vira candidato a Worker no Slice 2).
