# Projeto de aprendizado: Rust (WASM) + Mastra — Auditor de Canibalização de Conteúdo

## Contexto

Surgiu de um brainstorm: um amigo disse que "Rust é bom pra IA" e apontou o
`mastra.ai`. Esclarecimento que reorientou tudo:

- **Mastra é TypeScript** (framework de agentes/workflows/RAG, time do Gatsby),
  não Rust. Vive na camada de **orquestração** — o mesmo andar onde o usuário já
  trabalha (Next/TS).
- **Rust é bom pra IA numa camada diferente:** a "sala de máquinas" — inferência,
  embeddings, busca vetorial, edge/WASM (candle, burn, tokenizers da HF, Qdrant).
- Eles **não competem, se empilham:** Mastra em cima (maestro), Rust embaixo
  (execução pesada).

Objetivo do usuário: **aprender a stack Rust+Mastra primeiro**; virar produto é bônus.
Dentro do filtro "Rust só entra se ser rápido/barato/local FOR o produto", e do
arquétipo escolhido (**C: micro-ferramenta edge/WASM**, casa com a tese de SEO
passivo do portfólio nimblabs), a ideia que une os dois interesses do usuário
(DropQuery = parsing de arquivo gigante + OverlapScan = similaridade) é **um
auditor de conteúdo de site que roda no browser**.

**Resultado pretendido:** terminar um projeto pequeno onde o usuário *sente* por
que Rust existe (parsing de 50k linhas + similaridade O(n²) no browser, onde o JS
trava a aba), com Mastra fazendo a camada inteligente. Se gerar tráfego de SEO
("keyword cannibalization checker"), bônus.

## Produto (v1)

**Nome de trabalho:** `CannibalScan` (decisão do usuário; nome ancorado em termo de
busca com intenção = tráfego passivo).

Fluxo: usuário arrasta um **CSV de crawl** (export do Screaming Frog "Internal:
All" / Content, ou qualquer CSV com coluna de URL + coluna de texto) na página →
**Rust/WASM** parseia e roda similaridade local e de graça → UI mostra os
pares/clusters de páginas que se canibalizam → botão "explicar/recomendar" manda
**só os clusters** (payload pequeno) pra um agente **Mastra** que devolve auditoria
priorizada (qual manter como canônica, qual fundir/redirecionar, título/meta
consolidados, ordem de prioridade).

**Por que Rust ganha o lugar (honesto):**
1. Parsear um crawl de 10–50k linhas instantaneamente no browser (PapaParse engasga/
   congela em arquivo grande; WASM faz liso).
2. Similaridade par-a-par sobre milhares de páginas — JS trava a main thread por
   segundos/minutos; Rust/WASM é rápido, e MinHash/LSH leva pra quase-linear.

**Margem:** todo o trituramento (a parte cara em escala) é client-side = grátis.
Só a chamada final ao LLM (prompt pequeno) bate num backend fino pra esconder a key,
em modelo barato (Groq/Haiku). Alinha com o perfil cost-obsessed do usuário.

## Arquitetura

Três unidades com fronteiras limpas e testáveis em isolamento:

- **`wasm-core` (crate Rust → WASM via `wasm-bindgen`/`wasm-pack`)** — funções puras,
  sem I/O. Interface:
  - `parse_corpus(csv_bytes) -> Corpus` (slice 1)
  - `find_overlaps(corpus, threshold) -> OverlapReport` (slice 2)
  - Testável com `cargo test` nativo (rápido), independente do browser.
- **`web` (Next.js, estático)** — UI de drag-drop, chama o WASM, renderiza
  resultados. Sem lógica de negócio. Deploy barato (Vercel/EasyPanel).
- **`agent` (Mastra, server — API route Node)** — 1 agente + tool. Recebe um
  `OverlapReport` (JSON pequeno), devolve recomendações. Testável com fixture.

**Fronteiras (contratos):**
- WASM ↔ JS: o shape JSON de `Corpus` / `OverlapReport`.
- web ↔ Mastra: `OverlapReport` (in) → `Recommendations` (out).

**Fluxo de dados:**
1. Drop do CSV → JS lê bytes → passa ao WASM.
2. `parse_corpus` (crate `csv`): normaliza linhas em `{url, title, meta, h1, text,
   word_count}`, limpa/dedup. Retorna corpus + resumo.
3. `find_overlaps`: tokeniza texto, vetores TF-IDF, cosseno par-a-par (depois
   MinHash/LSH pra escalar). Pares acima do threshold = canibalização. Retorna
   clusters com score.
4. UI renderiza clusters (já útil **sem** LLM).
5. "Explicar/recomendar" → manda top clusters ao agente Mastra → auditoria
   priorizada. Opcional: tool de chat pra follow-up.

**Tratamento de erro / degradação graciosa:**
- CSV malformado → erro tipado do Rust → UI mostra "esperava colunas X".
- Arquivo além da memória → cap de linhas + aviso.
- LLM fora do ar → **mostra os resultados crus mesmo assim** (a parte grátis
  funciona sem o agente).

## Slices (modo aprender — cada um roda sozinho)

- **Slice 1 — esqueleto + parsing.** Next.js com drop de arquivo → `wasm-core`
  com `parse_corpus` → mostra tabela do corpus parseado. *Ensina:* ownership,
  structs, crate `csv`, erros, `wasm-bindgen`/`wasm-pack`, ponte WASM↔JS.
- **Slice 2 — similaridade.** `find_overlaps` (TF-IDF + cosseno; depois MinHash/LSH)
  → UI mostra clusters de canibalização. *Ensina:* iterators, vetores/matemática,
  um algoritmo de similaridade.
- **Slice 3 — agente Mastra.** API route com 1 agente + tool que recebe o
  `OverlapReport` e devolve auditoria priorizada (+ Q&A opcional). *Ensina:* Mastra
  (agente/tools/eval) — pouso macio, é TS.

**Fora de escopo v1 (YAGNI):** multi-site, contas, histórico, crawler próprio,
tempo real. Só depois, se houver tráfego.

## Verificação (end-to-end)

- **Rust:** `cargo test` com CSVs-fixture pequenos + teste de propriedade
  (similaridade simétrica). Rodar nativo antes de compilar pra WASM.
- **WASM:** `wasm-pack test --headless` pra confirmar os bindings.
- **Mastra:** alimentar um `OverlapReport`-fixture, assertar shape das
  recomendações; eval de qualidade em 1–2 casos golden.
- **E2E manual:** dropar um CSV de exemplo no browser → ver clusters → clicar
  recomendar → ver auditoria. Medir tempo de parse/similaridade num CSV grande
  (~50k linhas) pra confirmar o ganho de Rust vs. baseline JS.

## Pré-requisitos de ambiente

- Toolchain Rust (`rustup`), target `wasm32-unknown-unknown`, `wasm-pack`.
- Node (já tem). Conta/uso de LLM barato (Groq/OpenRouter/Anthropic) p/ o Mastra.
- Atenção: OneDrive corrompe `node_modules`/store do pnpm — considerar mover o repo
  pra fora do OneDrive (`C:\dev\`), como já foi feito com `estetia-demo`.

## Próximo passo

Ao aprovar, invocar a skill `writing-plans` pra detalhar o plano de implementação
do **Slice 1** (uma feature por vez, conforme regra de roadmap do usuário).
