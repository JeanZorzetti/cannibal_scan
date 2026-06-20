import type { ComparisonReport } from "@/lib/types";
import type { SiteMetrics } from "./metrics";

export interface ComparePage {
  url: string;
  title: string;
  h1: string;
  meta: string;
}

export function buildComparePrompt(
  report: ComparisonReport,
  metricsA: SiteMetrics,
  metricsB: SiteMetrics,
  pagesA: ComparePage[],
  pagesB: ComparePage[],
): string {
  const byUrl = (pages: ComparePage[]) => new Map(pages.map((p) => [p.url, p]));
  const mapA = byUrl(pagesA);
  const mapB = byUrl(pagesB);

  const fmtPage = (url: string, map: Map<string, ComparePage>) => {
    const p = map.get(url);
    return [
      `  URL: ${url}`,
      `  title: ${p?.title ?? ""}`,
      `  h1: ${p?.h1 ?? ""}`,
      `  meta: ${p?.meta ?? ""}`,
    ].join("\n");
  };

  const overlapBlock = report.overlaps
    .slice(0, 20)
    .map(
      (pair, i) =>
        `Overlap ${i + 1} (score ${pair.score.toFixed(2)}):\n` +
        `  Site A:\n${fmtPage(pair.a_url, mapA)}\n` +
        `  Site B:\n${fmtPage(pair.b_url, mapB)}`,
    )
    .join("\n\n");

  const gapBlock = report.gaps
    .slice(0, 20)
    .map((g) => `  - "${g.term}" (B avg weight: ${g.b_weight.toFixed(3)}, A avg weight: ${g.a_weight.toFixed(3)})`)
    .join("\n");

  const metricsBlock = [
    "Site A (to improve):",
    `  pages: ${metricsA.pages}, avg words/page: ${metricsA.avgWords}`,
    `  % with title: ${metricsA.pctWithTitle}%, % with meta: ${metricsA.pctWithMeta}%, % with H1: ${metricsA.pctWithH1}%`,
    "Site B (reference leader):",
    `  pages: ${metricsB.pages}, avg words/page: ${metricsB.avgWords}`,
    `  % with title: ${metricsB.pctWithTitle}%, % with meta: ${metricsB.pctWithMeta}%, % with H1: ${metricsB.pctWithH1}%`,
  ].join("\n");

  return [
    "You are a competitive SEO consultant.",
    "Site A is the client's site (to improve). Site B is the category leader.",
    "Your goal: generate prioritized, actionable recommendations so Site A can close the gap and outperform Site B in organic search.",
    "",
    "## Metrics",
    metricsBlock,
    "",
    "## Content Overlaps (pages competing for the same intent)",
    overlapBlock || "  (none above threshold)",
    "",
    "## Content Gaps (topics Site B covers that Site A barely covers)",
    gapBlock || "  (none detected)",
    "",
    "For each recommendation produce:",
    "- title: short label (5–8 words).",
    "- action: imperative sentence describing what to do (create, expand, rewrite, add, etc.).",
    "- target_pages: array of Site A URLs to act on (empty if the action is 'create a new page').",
    "- reference_pages: array of Site B URLs that illustrate the benchmark (may be empty).",
    "- rationale: 1–2 sentences explaining the SEO impact.",
    "- priority: integer where 1 is the highest priority.",
    "",
    "Return JSON shaped as { recommendations: Recommendation[] }, ordered by priority ascending.",
  ].join("\n");
}
