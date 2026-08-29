# Design Review — landing `cannibalscan.nimblabs.com`

**Data:** 2026-08-29 · **Alvo:** `site/index.html` em produção · **Método:** harness `design-review` + `ui-verification` (Playwright, 3 larguras, produção no ar).

Achados verificados no navegador. Cada item traz a evidência que o produziu — quem executar não precisa remedir.

---

## Diagnóstico

A landing é boa: direção coerente (mono + teal sobre pedra), FAQ que responde de verdade, GEO/SEO impecável, 1 request e 30 KB. O problema não é a página — é que ela vende um produto que **não tem porta**.

A promessa é "roda no seu browser, o CSV não sai da sua máquina" e o único caminho oferecido é `git clone` + instalar toolchain Rust GNU. O app existe, funciona, e não está publicado: `vercel.json` aponta `outputDirectory: site`, então o domínio serve só a landing. Todo o resto deste documento é secundário a isso.

Segundo eixo: a prova (o card do scan rodando) e a única CTA estão ambas fora do campo de visão — o card começa em 790px no 1440×900, a CTA em 92% da rolagem.

---

## Ações

Ordenadas por severidade × frequência. Severidade 0-4 na escala de `usability-heuristics`.

### 1 · Publicar o app — `conversion` — **sev 4**

**Achado.** A única CTA da página é "Read the code on GitHub", em `y=5460` de ~5900. A ordem de Tab da página inteira tem **3 links**, o primeiro a 92% da rolagem. `web/` é um Next funcional que não está no ar.

**Evidência.**
```js
// tabOrder, snapshot de produção
[ { text: "Read the code on GitHub", top: 5460 },
  { text: "nimblabs",                top: 5621 },
  { text: "github.com/JeanZorzetti/cannibal_scan", top: 5621 } ]
```
`vercel.json` → `{ "outputDirectory": "site" }`.

**Correção.** Publicar `web/` — a metade grátis (crawl + scan) não precisa de `OPENROUTER_API_KEY`, degrada sozinha se a key faltar. Trocar a CTA do hero para "Escanear um site"; GitHub vira secundário no rodapé.

- [ ] Publicar `web/` (subdomínio ou path `/app`)
- [ ] CTA primária no hero apontando pro app
- [ ] Rebaixar o link do GitHub a secundário

---

### 2 · Contraste do `--muted` — `accessibility` — **sev 3**

**Achado.** `--muted:#69747A` dá **3,85:1** sobre `--ground` e **4,15:1** sobre `--panel`. Reprova o mínimo de 4.5:1 (WCAG 1.4.3, nível AA). É a cor da maior parte da prosa: `.sub` (16px), `ol.stages p` (14px), `.col .why` (13,5px), `.pair` (12,5px), `footer`, `.card-foot`.

`--warn:#A96A11` dá **3,82:1** sobre o panel — usado no rótulo "Trade-off" e nos valores `301 →` do verdict.

**Evidência.** Cálculo de razão de contraste rodado na própria página:
```
muted on ground  3.85   ❌      signal on ground  5.77   ✅
muted on panel   4.15   ❌      keep on panel     5.53   ✅
warn on panel    3.82   ❌      ink on ground    14.50   ✅
```

**Correção.** `--muted:#5A656B` (≈4,6:1 no ground) e `--warn:#8A5509`. O resto da paleta passa — não mexer.

- [ ] Trocar os dois valores em `:root`
- [ ] Remedir com a mesma função antes de fechar

---

### 3 · A landing esconde o crawler — `conversion-copy` — **sev 3**

**Achado.** A página declara que o custo de entrada é ter Screaming Frog (ferramenta paga acima de 500 URLs). O app aceita **uma URL**: `web/src/app/api/crawl/route.ts` + o painel "Rastrear" em `SiteSourcePanel.tsx` rastreiam até 1000 páginas sozinhos. Isso não aparece em lugar nenhum da landing — nem no h1, nem nas quatro etapas, nem no FAQ "What do I need to run it?".

É o melhor matador de objeção que o produto tem e está ausente da página.

**Correção.** Crawler vira etapa 0 em `ol.stages`. O FAQ abre com "A URL." e o CSV passa a ser a alternativa, não o requisito.

- [ ] Nova etapa "Crawl" antes de "Parse" em `ol.stages`
- [ ] Reescrever o FAQ "What do I need to run it?"
- [ ] Espelhar em `site/llms.txt` (hoje também só cita o CSV)

---

### 4 · A assinatura nasce abaixo da dobra — `art-direction` — **sev 3**

**Achado.** O card do scan rodando — o argumento inteiro da página — começa em `top: 790px` num 1440×900. Só a barra de cabeçalho dele aparece na carga. No 360 começa em 833px.

Causa: `.hero-mark` em `clamp(104px,13vw,168px)` + 30px de margem consomem ~200px antes do eyebrow. No 768 o mark cai pra ~86px e o card entra na dobra — ou seja, a proporção **já está certa no tablet** e erra justamente onde há mais espaço.

**Evidência.** Screenshot 1440×900: card head visível em `y=792`, nada do scan. Screenshot 768×1024: card e duas primeiras linhas visíveis.

**Correção.** Mark para ~80px no desktop, ou inline ao lado do eyebrow. Meta: metade do card visível na carga.

> Nota: os commits `f7a72c1` e `56e820b` aumentaram o mark de propósito. A troca aqui é presença do símbolo × prova do produto — e a prova ganha, porque o símbolo continua presente a 80px e o card não continua visível a 168px.

- [ ] Reduzir `.hero-mark` no breakpoint desktop
- [ ] Screenshot 1440 depois, confirmando o card na dobra

---

### 5 · `.miss` empilha opacidade sobre contraste que já reprova — `accessibility` — **sev 3**

**Achado.** `.miss{opacity:.55}` aplica sobre o `--muted` do item 2 → as linhas 0.68 / 0.44 / 0.12 ficam perto de **1,8:1**. São justamente as linhas que dão sentido ao threshold: sem elas legíveis, "acima de 0.70" não quer dizer nada.

**Evidência.** Screenshot 360 dentro do card — as três linhas abaixo do limiar aparecem lavadas contra o panel.

**Correção.** Remover o `opacity`. "Abaixo do limiar" já está dito pela largura da barra e pela cor do score.

- [ ] Apagar `.miss{opacity:.55}`

---

### 6 · Árvore de acessibilidade sem landmarks — `accessibility` — **sev 2**

**Achado.** Sem `<main>`, sem skip link, e as 5 `<section>` não têm nome acessível — logo não viram `region`. Abaixo do `banner`, o snapshot é `generic` até o fim.

**Evidência.**
```js
{ hasMain: false, hasSkipLink: false,
  namedSections: [null, null, null, null, null] }
```

**Correção.** Envolver as seções em `<main>`; `aria-labelledby` em cada `section` apontando pro `h2` que ela já tem.

- [ ] `<main>` ao redor das seções
- [ ] `id` nos `h2` + `aria-labelledby` nas `section`

---

### 7 · Strip fixa come 16% da tela no mobile — `responsive-design` — **sev 2**

**Achado.** A `.strip` mede **101,78px** de altura no 360 (quebra em 4 linhas) e é `position:sticky`. Um sexto da viewport, permanente, ocupado por metadado.

**Evidência.** `document.querySelector('.strip').getBoundingClientRect().height` → `101.78125` em 360×640. No 768 são 72px (2 linhas).

**Correção.** `position:static` abaixo de 820px, ou reduzir a wordmark + `runs in the browser` nas telas pequenas.

- [ ] Regra no `@media (max-width:820px)`

---

### 8 · Rótulos da escala colidem no 360 — `responsive-design` — **sev 2**

**Achado.** "THRESHOLD 0.70" (em `left:70%`) sobrepõe "1.00" (em `left:100%` com `translateX(-100%)`). Em 345px úteis o primeiro rótulo começa em ~216px e o segundo em ~267px.

**Evidência.** Screenshot 360, dentro do card: `THRESHOLD▮0.70` com o `1.00` por cima.

**Correção.** Esconder o `1.00` abaixo de 480px, ou `.thr b` passa a mostrar só `0.70`.

- [ ] Media query escondendo o rótulo `1.00`

---

### 9 · Carrossel infinito sem controle de pausa — `accessibility` — **sev 2**

**Achado.** O card troca de amostra a cada 8,2s indefinidamente (`setInterval`, sem fim) sem mecanismo de pausar/parar/esconder. Falha WCAG 2.2.2 (Pause, Stop, Hide — **nível A**): conteúdo em movimento que dura mais de 5s e roda em paralelo com outro conteúdo precisa de controle.

`prefers-reduced-motion` está tratado corretamente (CSS + `matchMedia` no JS, que renderiza tudo de uma vez e sai antes do `setInterval`) — mas isso não é o mecanismo que o critério pede.

**Correção.** Parar depois da terceira amostra. Mais barato que um botão de pausa e resolve o critério.
```js
var t = setInterval(function () {
  i = (i + 1) % runs.length;
  play(runs[i]);
  if (i === runs.length - 1) clearInterval(t);
}, 8200);
```

- [ ] Encerrar o loop após a última amostra

---

### 10 · O par lê como palavra única — `accessibility` — **sev 2**

**Achado.** O snapshot mostra `/blog/best-crm-for-clinicsvs/blog/crm-for-clinics-guide` — o separador `<u>vs</u>` só tem `padding` CSS, que não existe pro leitor de tela. Além disso a lista muda a cada 8,2s dentro de um `<ul>` comum, sem `aria-live`.

**Evidência.** Trecho do snapshot de produção:
```yaml
- listitem:
  - paragraph: /blog/best-crm-for-clinicsvs/blog/crm-for-clinics-guide
  - paragraph: "0.86"
```

**Correção.** `aria-hidden="true"` no `.card`. É amostra roteirizada — o próprio rodapé do card admite: *"Scripted sample, hand-written to match the shape of a real report — not a live crawl."* Decorativa por definição, e um atributo resolve os dois problemas.

- [ ] `aria-hidden="true"` em `.card`

---

## O que não achou nada

Registrado para não parecer esquecimento:

- **`web-performance`** — limpo. 1 request, 30 KB, zero fonte externa, zero domínio de terceiro, TTFB 160ms, **CLS 0,0001** em carga limpa de 26s. Os `min-height` em `.rows` (214px) e `.verdict` (96px) fizeram o trabalho: a animação não desloca layout.
- **`seo-geo`** — allowlist explícita de GPTBot / OAI-SearchBot / ClaudeBot / PerplexityBot / Google-Extended, `llms.txt`, sitemap, canonical, `@graph` com `Organization` + `WebSite` + `SoftwareApplication` + `FAQPage` espelhando o FAQ visível. Nada a corrigir.
- **`motion-design`** — o tratamento de `prefers-reduced-motion` está correto em CSS e em JS. O único problema de movimento é o loop infinito, que está na ação 9.
- **`design-systems`** — paleta pequena e aplicada com consistência. Os únicos defeitos são os dois valores da ação 2.

---

## Fora de escopo agora

- **Sem `og:image` e sem `twitter:card`** numa página cuja tese é visual. Vale, mas depois da ação 1 — não adianta otimizar o compartilhamento de uma página sem porta.
- **`applicationCategory: "SEO audit tool"`** não é valor de enum do schema.org. O Google tolera; custo de uma linha, prioridade zero.
- **`web/` está em português, com Tailwind default** (`Arial, Helvetica`, `blue-700`, `gray-200`) e nenhum token da landing. Real, mas é o passo 2 da ação 1, não item paralelo: só faz sentido depois da decisão de publicar.
- **`word-break:break-all`** quebra URL no meio da palavra (`/ser vices/botox`). `overflow-wrap:anywhere` quebra melhor. Cosmético.

---

## Não verificado

Dispositivo real (toque, teclado virtual, rede móvel), leitor de tela de verdade (NVDA/VoiceOver anunciam diferente do snapshot), dado de campo (CrUX), e o app `web/` — não está no ar, então nada dele foi conferido em navegador.
