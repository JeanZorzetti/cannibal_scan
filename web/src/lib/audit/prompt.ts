// Page metadata the agent needs to consolidate a title/meta. Deliberately excludes
// the full `text` — the cannibalization signal already came through in the score,
// so the prompt stays small.
export interface AuditPage {
  url: string;
  title: string;
  h1: string;
  meta: string;
}

// Build a compact, deterministic prompt: one labelled block per cluster listing
// each page's url/title/h1/meta, plus instructions for the structured output.
export function buildAuditPrompt(clusters: string[][], pages: AuditPage[]): string {
  const byUrl = new Map(pages.map((p) => [p.url, p]));

  const clusterBlocks = clusters
    .map((cluster, i) => {
      const lines = cluster
        .map((url) => {
          const p = byUrl.get(url);
          return [
            `  - URL: ${url}`,
            `    title: ${p?.title ?? ""}`,
            `    h1: ${p?.h1 ?? ""}`,
            `    meta: ${p?.meta ?? ""}`,
          ].join("\n");
        })
        .join("\n");
      return `Cluster ${i + 1}:\n${lines}`;
    })
    .join("\n\n");

  return [
    "You are an SEO content cannibalization auditor.",
    "Each cluster below is a group of pages on the same site competing for the same search intent.",
    "For EACH cluster, produce exactly one recommendation with these fields:",
    "- keep: the single URL to keep as canonical (MUST be one of that cluster's URLs).",
    "- merge_or_redirect: the OTHER cluster URLs to merge into or 301-redirect to the canonical one.",
    "- consolidated_title: one strong <title> for the canonical page.",
    "- consolidated_meta: one meta description for the canonical page.",
    "- priority: an integer where 1 is the most urgent cluster to fix.",
    "- rationale: one or two sentences explaining the choice.",
    "Return JSON shaped as { items: AuditItem[] } with one item per cluster.",
    "",
    clusterBlocks,
  ].join("\n");
}
