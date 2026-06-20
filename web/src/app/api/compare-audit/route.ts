export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { runCompareAudit } from "@/lib/compare/run-compare-audit";
import { siteMetrics } from "@/lib/compare/metrics";
import { AUDIT_MODEL_ID } from "@/mastra/agents/audit-agent";
import type { ComparePage } from "@/lib/compare/prompt";
import type { ComparisonReport, Corpus } from "@/lib/types";

interface CompareAuditRequest {
  report: ComparisonReport;
  corpusA: Corpus;
  corpusB: Corpus;
}

function claudeCodeInstalled(): boolean {
  return existsSync(join(homedir(), ".claude", ".credentials.json"));
}

export async function POST(req: Request): Promise<Response> {
  if (!claudeCodeInstalled()) {
    return NextResponse.json(
      { error: "Claude Code não encontrado — instale em claude.ai/code e faça login." },
      { status: 502 },
    );
  }

  let body: CompareAuditRequest;
  try {
    body = (await req.json()) as CompareAuditRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body?.report || (!body.report.overlaps?.length && !body.report.gaps?.length)) {
    return NextResponse.json({ error: "nenhum dado para auditar" }, { status: 400 });
  }

  const metricsA = siteMetrics(body.corpusA);
  const metricsB = siteMetrics(body.corpusB);

  const involvedA = new Set(body.report.overlaps.map((p) => p.a_url));
  const involvedB = new Set(body.report.overlaps.map((p) => p.b_url));

  const toPage = (p: { url: string; title: string; h1: string; meta: string }): ComparePage => ({
    url: p.url, title: p.title, h1: p.h1, meta: p.meta,
  });

  const pagesA = body.corpusA.pages.filter((p) => involvedA.has(p.url)).map(toPage);
  const pagesB = body.corpusB.pages.filter((p) => involvedB.has(p.url)).map(toPage);

  try {
    const result = await runCompareAudit(body.report, metricsA, metricsB, pagesA, pagesB);
    return NextResponse.json({ recommendations: result.recommendations, model: AUDIT_MODEL_ID });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("compare-audit failed:", e);
    return NextResponse.json({ error: `Auditoria falhou: ${msg}` }, { status: 502 });
  }
}
