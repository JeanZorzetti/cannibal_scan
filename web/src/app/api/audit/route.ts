import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { runAudit } from "@/lib/audit/run-audit";
import { AUDIT_MODEL_ID } from "@/mastra/agents/audit-agent";
import type { AuditPage } from "@/lib/audit/prompt";
import type { OverlapReport } from "@/lib/types";

export const runtime = "nodejs";

interface AuditRequest {
  report: OverlapReport;
  pages: AuditPage[];
}

// The audit uses the Claude Code CLI subprocess — confirm it is installed.
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

  let body: AuditRequest;
  try {
    body = (await req.json()) as AuditRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body?.report?.pairs?.length) {
    return NextResponse.json(
      { error: "nenhum par para auditar" },
      { status: 400 },
    );
  }

  try {
    const result = await runAudit(body.report, body.pages ?? []);
    return NextResponse.json({ items: result.items, model: AUDIT_MODEL_ID });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("audit failed:", e);
    return NextResponse.json(
      { error: `Auditoria falhou: ${msg}` },
      { status: 502 },
    );
  }
}
