export interface CrawledPage {
  url: string;
  title: string;
  h1: string;
  meta: string;
  content: string;
}

/** Escape a single CSV field per RFC-4180. */
function escapeField(value: string): string {
  const s = value.replace(/\r\n/g, "\n");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Produce a CSV string with the exact headers the cannibal_scan Rust parser
 * expects: Address, Title 1, H1-1, Meta Description 1, Content.
 */
export function toCannibalCsv(rows: CrawledPage[]): string {
  const header = "Address,Title 1,H1-1,Meta Description 1,Content";
  const lines = rows.map((r) =>
    [r.url, r.title, r.h1, r.meta, r.content]
      .map(escapeField)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
