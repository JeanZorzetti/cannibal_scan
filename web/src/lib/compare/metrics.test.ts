import { describe, it, expect } from "vitest";
import { siteMetrics } from "./metrics";
import type { Corpus } from "@/lib/types";

function corpus(pages: Corpus["pages"]): Corpus {
  return { pages, total_rows: pages.length, skipped_rows: 0 };
}

function page(url: string, title: string, h1: string, meta: string, words: number) {
  return { url, title, h1, meta, text: "word ".repeat(words).trim(), word_count: words };
}

describe("siteMetrics", () => {
  it("returns zeros for empty corpus", () => {
    expect(siteMetrics(corpus([]))).toEqual({
      pages: 0, avgWords: 0, pctWithTitle: 0, pctWithMeta: 0, pctWithH1: 0,
    });
  });

  it("computes correct averages", () => {
    const c = corpus([
      page("https://a.com/1", "Title", "H1", "Meta", 100),
      page("https://a.com/2", "Title", "", "", 200),
    ]);
    const m = siteMetrics(c);
    expect(m.pages).toBe(2);
    expect(m.avgWords).toBe(150);
    expect(m.pctWithTitle).toBe(100);
    expect(m.pctWithH1).toBe(50);
    expect(m.pctWithMeta).toBe(50);
  });
});
