import { NextResponse } from "next/server";
import { runAudit } from "@/lib/audit/run-audit";
import { AUDIT_MODEL_ID } from "@/mastra/agents/audit-agent";
import type { AuditPage } from "@/lib/audit/prompt";
import type { OverlapReport } from "@/lib/types";

// Spawns the Mastra agent / makes an outbound LLM call — must run in Node, not Edge.
export const runtime = "nodejs";

interface AuditRequest {
  report: OverlapReport;
  pages: AuditPage[];
}

export async function POST(req: Request): Promise<Response> {
  // Env vars first: a missing key is the most common failure. Surface it clearly
  // (without leaking anything) so the UI can degrade gracefully.
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY ausente — configure em web/.env.local" },
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
    // Never leak the key or a stack to the client.
    console.error("audit failed:", e);
    return NextResponse.json(
      { error: "o agente de auditoria falhou — tente novamente" },
      { status: 502 },
    );
  }
}
