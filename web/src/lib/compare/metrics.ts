import type { Corpus } from "@/lib/types";

export interface SiteMetrics {
  pages: number;
  avgWords: number;
  pctWithTitle: number;
  pctWithMeta: number;
  pctWithH1: number;
}

export function siteMetrics(corpus: Corpus): SiteMetrics {
  const n = corpus.pages.length;
  if (n === 0) {
    return { pages: 0, avgWords: 0, pctWithTitle: 0, pctWithMeta: 0, pctWithH1: 0 };
  }
  let totalWords = 0;
  let withTitle = 0;
  let withMeta = 0;
  let withH1 = 0;
  for (const p of corpus.pages) {
    totalWords += p.word_count;
    if (p.title.trim()) withTitle++;
    if (p.meta.trim()) withMeta++;
    if (p.h1.trim()) withH1++;
  }
  return {
    pages: n,
    avgWords: Math.round(totalWords / n),
    pctWithTitle: Math.round((withTitle / n) * 100),
    pctWithMeta: Math.round((withMeta / n) * 100),
    pctWithH1: Math.round((withH1 / n) * 100),
  };
}
