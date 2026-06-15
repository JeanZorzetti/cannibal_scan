import { clusterPairs } from "./cluster";
import { buildAuditPrompt, type AuditPage } from "./prompt";
import { parseAuditReport, type AuditReport } from "./schema";
import type { OverlapReport } from "../types";

// The model boundary: anything that turns the audit prompt into a raw report-shaped
// value. The real one wraps the Mastra agent; tests inject a fake so no network or
// API key is touched.
export interface AuditModel {
  generateReport(prompt: string): Promise<unknown>;
}

export interface RunAuditOptions {
  model?: AuditModel;
}

// Cluster the cannibalization pairs, ask the model for a recommendation per cluster,
// and validate the result against the AuditReport contract.
export async function runAudit(
  report: Pick<OverlapReport, "pairs">,
  pages: AuditPage[],
  opts: RunAuditOptions = {},
): Promise<AuditReport> {
  const clusters = clusterPairs(report.pairs);
  if (clusters.length === 0) return { items: [] };

  const prompt = buildAuditPrompt(clusters, pages);
  const model = opts.model ?? (await defaultModel());
  const raw = await model.generateReport(prompt);
  return parseAuditReport(raw);
}

// Loaded lazily so unit tests (which always inject a model) never construct the
// Mastra agent or read OPENROUTER_API_KEY.
async function defaultModel(): Promise<AuditModel> {
  const { auditModel } = await import("@/mastra/agents/audit-agent");
  return auditModel;
}
