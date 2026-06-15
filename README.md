# CannibalScan

Auditor de canibalização de conteúdo de SEO que roda **no browser**. Você arrasta
um CSV de crawl (Screaming Frog) e o parsing/análise pesada acontece localmente em
**Rust compilado pra WebAssembly** — sem servidor, custo marginal ~zero. Um botão
"Explicar/recomendar" manda os pares canibalizando a um **agente Mastra** (server-only,
OpenRouter) que devolve uma auditoria priorizada. Projeto de aprendizado da stack
Rust(WASM) + Mastra.

## Estrutura

- `wasm-core/` — crate Rust. Lógica de parsing PURA (`parser.rs`, testável com
  `cargo test`) atrás de um wrapper `wasm-bindgen` fino (`lib.rs::parse_corpus_json`).
- `web/` — app Next.js (App Router, TS, Tailwind). UI (drag-drop de CSV → tabela →
  pares → auditoria) + o agente Mastra em `src/mastra/` e a lógica de auditoria pura
  em `src/lib/audit/` (clustering, schema zod, prompt), exposta pela API route
  `src/app/api/audit/route.ts` (server-only, esconde a key).
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

# 4. testes TS do agente (puro: clustering, schema, prompt, runAudit com mock)
cd web && npm install && npm run test

# 5. rodar o web
npm run dev
# abre http://localhost:3000 (ou PORT=3100 npm run dev)
```

## Agente de auditoria (Slice 3)

O agente roda **só no servidor** (Mastra + OpenRouter). A key fica em `web/.env.local`
(gitignored) — copie de `web/.env.example`:

```sh
OPENROUTER_API_KEY=sk-or-v1-...        # https://openrouter.ai/keys
AUDIT_MODEL=google/gemini-2.5-flash    # opcional (default)
```

Sem a key, a parte grátis (parsing + pares) continua funcionando — só a auditoria
fica indisponível (degradação graciosa).

## Status

Slices 1 (parsing), 2 (similaridade/canibalização) e 3 (agente Mastra de auditoria
priorizada) completos — **v1 fechado**.
