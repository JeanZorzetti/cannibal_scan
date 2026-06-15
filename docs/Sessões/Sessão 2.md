# Prompt de continuação — CannibalScan, Slice 2

> Cole o bloco abaixo (a partir de "CONTEXTO") num chat novo do Claude Code.
> Ele é autossuficiente: a sessão fria não precisa re-descobrir nada do Slice 1.

---

## CONTEXTO

Estou continuando o projeto **CannibalScan** (`C:\dev\cannibalscan`) — um auditor de
canibalização de conteúdo de SEO que roda **no browser**: usuário arrasta um CSV de
crawl, o trabalho pesado acontece em **Rust compilado pra WebAssembly**, e (no futuro)
um agente **Mastra** gera a auditoria. É um projeto de **aprendizado** da stack
Rust(WASM)+Mastra. Idioma das respostas: **português**; código/commits em inglês.

**Leia primeiro estes 2 arquivos** (são a fonte de verdade):
- Spec/design: `C:\Users\jeanz\.claude\plans\um-amigo-meu-me-playful-kazoo.md`
- Plano por slices: `C:\dev\cannibalscan\docs\superpowers\plans\2026-06-15-slice1-parsing.md`
  (tem a seção "Fora de escopo" que aponta Slice 2/3)

### O que JÁ está pronto (Slice 1 — COMPLETO e verificado E2E no browser)
Crate `wasm-core` (Rust puro testável + wrapper wasm-bindgen fino) + app `web` (Next 16).
- `wasm-core/src/types.rs` — `struct Page { url, title, meta, h1, text, word_count }` e
  `struct Corpus { pages: Vec<Page>, total_rows, skipped_rows }` (derivam serde).
- `wasm-core/src/parser.rs` — `parse_corpus(&[u8]) -> Result<Corpus, ParseError>` (parsing
  de CSV, detecção de coluna case-insensitive, dedup por URL). 6 testes em
  `wasm-core/tests/parser_test.rs`.
- `wasm-core/src/lib.rs` — `pub mod parser; pub mod types;` + `#[wasm_bindgen] parse_corpus_json(&[u8]) -> Result<JsValue, JsValue>`.
- `web/src/lib/wasm.ts` — `parseCsv(bytes) -> Promise<Corpus>` (importa de `@/wasm/...`).
- `web/src/lib/types.ts` — espelho TS de `Page`/`Corpus`.
- `web/src/app/page.tsx` — drag-drop de CSV → tabela.
- 4 commits na branch `main`: `38f32e0`, `abf5b68`, `3778f62`, `c219dea`.
  (Repo é local, **sem remote** — não tem `git push` a fazer, a menos que eu peça pra criar GitHub.)

### PEGADINHAS DE AMBIENTE — leia ou vai perder tempo
1. **PATH:** `cargo`/`wasm-pack` NÃO estão no PATH de shells novos. Prefixe TODO comando:
   `$env:PATH = "$(Join-Path $env:USERPROFILE '.cargo\bin');$env:PATH"`
2. **Toolchain GNU** é o default (`stable-x86_64-pc-windows-gnu`); target `wasm32-unknown-unknown`
   e `wasm-pack 0.13.1` já instalados. NÃO troque pra MSVC (não tem VS Build Tools).
3. **`wasm-bindgen-test` está escopado ao wasm32** em `Cargo.toml`
   (`[target.'cfg(target_arch="wasm32")'.dev-dependencies]`) e os testes wasm têm
   `#![cfg(target_arch="wasm32")]` no topo. MANTENHA assim, senão `cargo test` nativo
   tenta compilar `windows-sys` no host GNU e quebra (dlltool/CreateProcess).
4. **O app `web` usa `npm`, NÃO pnpm.** (O gate de build-scripts do pnpm 10/11 faz o
   `next dev` do Next 16 abortar.) Não reintroduza pnpm.
5. **O pacote WASM vive em `web/src/wasm/`** (build output, **gitignored**). O Turbopack
   não resolve dep via junction pra fora do root, por isso o pkg fica DENTRO do web.
   Depois de QUALQUER mudança no Rust, **regenere**:
   `wasm-pack build wasm-core --target web --out-dir ../web/src/wasm` (rodar de `C:\dev\cannibalscan`).
   No TS importa via `@/wasm/cannibalscan_wasm_core.js` (init() default + `parse_corpus_json`).

### Como verificar (gates reais)
```sh
# de C:\dev\cannibalscan (com cargo no PATH — ver pegadinha 1)
cd wasm-core && cargo test              # testes nativos do core (rápido)
wasm-pack test --node                   # testes no alvo wasm32
# regenerar pkg + rodar web:
cd .. && wasm-pack build wasm-core --target web --out-dir ../web/src/wasm
cd web && npm run dev                   # http://localhost:3000 (ou PORT=3100)
```
Pra E2E no browser uso o MCP do Playwright (navegar, injetar um CSV no `input[type=file]`
via `DataTransfer`+evento `change`, ler `[data-testid="summary"]`/`tbody tr`).

---

## TAREFA DESTA SESSÃO: Slice 2 — Similaridade / canibalização

Objetivo: detectar pares de páginas que **competem entre si** (canibalização de SEO),
usando similaridade de conteúdo, **tudo em Rust/WASM no browser** (é onde Rust brilha:
O(n²) sobre muitos docs sem travar a aba). Seguir o MESMO padrão do Slice 1: lógica Rust
PURA num módulo novo testável com `cargo test`, wrapper wasm-bindgen fino, UI no `web`.

Antes de codar, faça um mini-brainstorm comigo (1-2 perguntas) sobre 2 decisões:
1. **Quais campos comparar** — só `text`, ou `title`+`h1`+`text` ponderados? (canibalização
   de SEO costuma ser mais sobre title/h1/tema do que corpo inteiro).
2. **Threshold default** de similaridade pra marcar como "canibalizando" (ex.: cosseno ≥ 0.7).

### Esboço técnico sugerido (ajuste no brainstorm)
- Novo `wasm-core/src/overlaps.rs`:
  - `pub struct OverlapPair { pub a: String, pub b: String, pub score: f64 }` (a/b = urls)
  - `pub struct OverlapReport { pub pairs: Vec<OverlapPair>, pub compared: usize }`
  - `pub fn find_overlaps(corpus: &Corpus, threshold: f64) -> OverlapReport`
    - tokeniza (lowercase, split em não-alfanumérico), monta TF-IDF por página, cosseno
      par-a-par; retorna pares com `score >= threshold`, ordenados desc.
    - v1: O(n²) cosseno puro (didático). MinHash/LSH = stretch opcional, só se quiser
      sentir LSH — não bloquear o slice nisso.
  - Derivar serde em `OverlapPair`/`OverlapReport` (em `types.rs` ou no próprio módulo).
- `lib.rs`: `pub mod overlaps;` + `#[wasm_bindgen] find_overlaps_json(csv_bytes: &[u8], threshold: f64) -> Result<JsValue, JsValue>`
  (parseia + acha overlaps numa chamada, ou receba um Corpus já parseado — decidir).
- Testes: `tests/overlaps_test.rs` (nativo) com casos: 2 páginas quase idênticas → score alto;
  2 páginas díspares → score baixo/ausente; simetria do score. Smoke wasm em `wasm_test.rs`.
- UI (`web/src/app/page.tsx` + `lib/wasm.ts`): após parsear, chamar find_overlaps e
  renderizar a lista de pares canibalizando (url A ↔ url B · score), ordenada.

### Disciplina (regras do usuário)
- **TDD**: teste falhando → mínimo pra passar → commit. Commits frequentes em inglês,
  terminando com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Uma feature/slice por sessão** — NÃO avançar pro Slice 3 (Mastra) sem eu pedir.
- Respostas concisas; agir > analisar quando a tarefa é clara.
- Ao terminar, atualizar a memória do projeto (`project-cannibalscan` em
  `~/.claude/projects/.../memory/`) com o status do Slice 2.
