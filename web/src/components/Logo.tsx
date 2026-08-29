// A página mordida. Objeto: uma página do crawl — os vãos brancos são os campos
// que o algoritmo pesa (wasm-core/src/overlaps.rs): title ×3, h1 ×2, meta ×1,
// body ×1, e a espessura de cada vão é o próprio peso. A mordida é o dado:
// os 12 pares do crawl-demo publicado em site/index.html, e só os que passam do
// threshold 0.70 arrancam material — abaixo dele a borda fica lisa.
//
// Receita de regeração: página 38x48. Arco mestre da mordida r=15 centrado em
// (44,24) — fora da página, entra 6px pela direita. Sobre esse arco, de 0.58π a
// 1.42π, um dente por par na ordem do demo (0.86 0.74 0.71 0.21 0.91 0.68 0.44
// 0.12 0.79 0.73 0.52 0.18); dente só existe se score >= 0.70 e tem raio
// (score − 0.6) × 18, então o par mais canibalizado é o que abre o maior rasgo.
// Mudou o threshold ou os pares? Recalcule os círculos da máscara, nada à mão.
//
// viewBox = bbox real da página (0 0 38 48) — sem moldura vazia em volta.
// ponytail: id de máscara fixo — instâncias repetidas na mesma página resolvem
// para a mesma definição idêntica, então não precisa de uid por instância.
const Logo = ({ className = "h-9 w-auto" }: { className?: string }) => (
  <svg viewBox="0 0 38 48" fill="currentColor" className={className} role="img" aria-label="CannibalScan">
    <mask id="csBite">
      <rect width="38" height="48" fill="#fff" />
      <g fill="#000">
        <rect x="4" y="5" width="20" height="3" />
        <rect x="4" y="11" width="15" height="2" />
        <rect x="4" y="16" width="22" height="1" />
        <rect x="4" y="20" width="22" height="1" />
        <rect x="4" y="24" width="18" height="1" />
        <rect x="4" y="28" width="22" height="1" />
        <circle cx="44" cy="24" r="15" />
        <circle cx="38.7" cy="38.03" r="4.68" />
        <circle cx="35.76" cy="36.54" r="2.52" />
        <circle cx="33.23" cy="34.44" r="1.98" />
        <circle cx="29.81" cy="28.86" r="5.58" />
        <circle cx="31.21" cy="16.16" r="3.42" />
        <circle cx="33.23" cy="13.56" r="2.34" />
      </g>
    </mask>
    <rect width="38" height="48" mask="url(#csBite)" />
  </svg>
);

export default Logo;
