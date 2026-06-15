import "server-only";
import { Agent } from "@mastra/core/agent";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { AuditReportSchema } from "@/lib/audit/schema";
import type { AuditModel } from "@/lib/audit/run-audit";

// The cheap, structured-output-friendly model chosen for this slice. Overridable
// via env so the model can be swapped without code changes.
export const AUDIT_MODEL_ID =
  process.env.AUDIT_MODEL ?? "google/gemini-2.0-flash-001";

const PERSONA = [
  "You are a precise SEO content cannibalization auditor.",
  "You consolidate groups of competing pages into a single canonical page,",
  "choosing the strongest URL to keep and recommending the rest be merged or",
  "301-redirected. You write tight, search-friendly titles and meta descriptions",
  "and you never invent URLs that are not in the provided cluster.",
].join(" ");

// Constructed lazily and memoized: the OpenRouter key is read from the server
// environment only when the agent is first used (inside the route handler).
let agent: Agent | null = null;

function getAgent(): Agent {
  if (!agent) {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    agent = new Agent({
      id: "seo-audit",
      name: "seo-audit",
      instructions: PERSONA,
      model: openrouter.chat(AUDIT_MODEL_ID),
    });
  }
  return agent;
}

export const auditModel: AuditModel = {
  async generateReport(prompt: string): Promise<unknown> {
    const result = await getAgent().generate(prompt, {
      structuredOutput: { schema: AuditReportSchema },
    });
    return result.object;
  },
};
