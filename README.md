# CannibalScan

Auditor de canibalização de conteúdo de SEO que roda **no browser**. Você arrasta
um CSV de crawl (Screaming Frog) e o parsing/análise pesada acontece localmente em
**Rust compilado pra WebAssembly** — sem servidor, custo marginal ~zero. Projeto de
aprendizado da stack Rust(WASM) + (futuramente) Mastra.

## Estrutura

- `wasm-core/` — crate Rust. Lógica de parsing PURA (`parser.rs`, testável com
  `cargo test`) atrás de um wrapper `wasm-bindgen` fino (`lib.rs::parse_corpus_json`).
- `web/` — app Next.js (App Router, TS, Tailwind). Só UI: drag-drop de CSV → tabela.
- `docs/superpowers/` — spec e planos de implementação por slice.

## Pré-requisitos

- Rust (toolchain **GNU** no Windows: `rustup default stable-x86_64-pc-windows-gnu`),
  target `wasm32-unknown-unknown`, e `wasm-pack`.
- Node + npm.
- No Windows, o `cargo`/`wasm-pack` podem não estar no PATH de shells novos; rode
  com `~/.cargo/bin` no PATH.

## Build & run

O pacote WASM (`web/src/wasm/`) é **build output gitignored** — regenere antes de
rodar o web:

```sh
# 1. testes do core (nativo)
cd wasm-core && cargo test

# 2. testes WASM (alvo wasm32, via Node)
wasm-pack test --node

# 3. gerar o pacote WASM dentro do app web
wasm-pack build wasm-core --target web --out-dir ../web/src/wasm

# 4. rodar o web
cd web && npm install && npm run dev
# abre http://localhost:3000 (ou PORT=3100 npm run dev)
```

## Status

Slice 1 (parsing + UI de tabela) completo. Próximos: Slice 2 (similaridade /
canibalização) e Slice 3 (agente Mastra que gera auditoria priorizada).
