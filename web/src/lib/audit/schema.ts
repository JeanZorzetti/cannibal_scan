import { z } from "zod";

// One recommendation per cluster of competing pages. The base object is what the
// LLM is asked to produce (representable as JSON schema); cross-field invariants
// live in parseAuditReport so the model-facing schema stays plain.
export const AuditItemSchema = z.object({
  cluster: z.array(z.string()).min(2),
  keep: z.string(),
  merge_or_redirect: z.array(z.string()),
  consolidated_title: z.string(),
  consolidated_meta: z.string(),
  priority: z.number().int(),
  rationale: z.string(),
});

export const AuditReportSchema = z.object({
  items: z.array(AuditItemSchema),
});

export type AuditItem = z.infer<typeof AuditItemSchema>;
export type AuditReport = z.infer<typeof AuditReportSchema>;
export type AuditResponse = AuditReport & { model: string };

// Strict parse: zod shape + invariants the schema alone can't express — the kept
// URL must belong to its cluster, and everything merged/redirected must be the
// other cluster URLs. Throws on violation so callers can degrade gracefully.
export function parseAuditReport(raw: unknown): AuditReport {
  const report = AuditReportSchema.parse(raw);
  for (const item of report.items) {
    if (!item.cluster.includes(item.keep)) {
      throw new Error(`keep "${item.keep}" is not one of the cluster URLs`);
    }
    for (const url of item.merge_or_redirect) {
      if (url === item.keep || !item.cluster.includes(url)) {
        throw new Error(
          `merge_or_redirect "${url}" must be a cluster URL other than keep`,
        );
      }
    }
  }
  return report;
}
