import { buildComparePrompt, type ComparePage } from "./prompt";
import { parseCompareReport, type CompareReport } from "./schema";
import type { ComparisonReport } from "@/lib/types";
import type { SiteMetrics } from "./metrics";
import type { AuditModel } from "@/lib/audit/run-audit";

export interface RunCompareAuditOptions {
  model?: AuditModel;
}

export async function runCompareAudit(
  report: ComparisonReport,
  metricsA: SiteMetrics,
  metricsB: SiteMetrics,
  pagesA: ComparePage[],
  pagesB: ComparePage[],
  opts: RunCompareAuditOptions = {},
): Promise<CompareReport> {
  const prompt = buildComparePrompt(report, metricsA, metricsB, pagesA, pagesB);
  const model = opts.model ?? (await defaultModel());
  const raw = await model.generateReport(prompt);
  return parseCompareReport(raw);
}

async function defaultModel(): Promise<AuditModel> {
  const { auditModel } = await import("@/mastra/agents/audit-agent");
  return auditModel;
}
