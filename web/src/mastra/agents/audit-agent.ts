import "server-only";
import { spawn } from "child_process";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { AuditModel } from "@/lib/audit/run-audit";

export const AUDIT_MODEL_ID = "claude-sonnet-4-6";

// Resolve the path to the claude binary. On systems where the VS Code extension
// is the delivery mechanism (Windows common case), the binary lives inside the
// extension folder and is NOT on PATH — so we locate it explicitly.
function resolveClaude(): string {
  // 1. VS Code extension delivery (most common on Windows with the Claude Code extension)
  const extDir = join(homedir(), ".vscode", "extensions");
  if (existsSync(extDir)) {
    const entries = readdirSync(extDir);
    const ext = entries.find((e) => e.startsWith("anthropic.claude-code-"));
    if (ext) {
      const bin = join(extDir, ext, "resources", "native-binary", "claude.exe");
      if (existsSync(bin)) return `"${bin}"`;
    }
  }
  // 2. Fallback: assume 'claude' is on PATH (npm global install or Linux/Mac)
  return "claude";
}

const CLAUDE_BIN = resolveClaude();

// Run the Claude Code CLI as a subprocess — uses the Pro subscription session
// (same mechanism as Sofia/POLARIS) instead of the direct API which has a low
// rate limit for consumer OAuth tokens.
function runClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cmd = `${CLAUDE_BIN} --print --dangerously-skip-permissions --output-format json --model ${AUDIT_MODEL_ID}`;

    // Strip API credentials so the CLI uses the subscription OAuth session,
    // not pay-per-token API billing (mirrors what Sofia's ClaudeCliService does).
    const env = { ...process.env, CI: "true" } as NodeJS.ProcessEnv;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    const child = spawn(cmd, [], { shell: true, env });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    child.on("error", (err: Error) => {
      reject(new Error(`Falha ao iniciar claude CLI: ${err.message}`));
    });

    child.on("close", (code: number | null) => {
      if (code !== 0) {
        reject(new Error(`claude CLI saiu com código ${code}: ${stderr.trim()}`));
        return;
      }
      // Strip ANSI escape codes, then parse --output-format json envelope
      const text = stdout.replace(/\x1B\[\d+m/g, "").trim();
      try {
        const envelope = JSON.parse(text) as { result?: string; is_error?: boolean };
        if (envelope.is_error) {
          reject(new Error(`Claude retornou erro: ${envelope.result ?? text}`));
          return;
        }
        resolve(envelope.result ?? text);
      } catch {
        resolve(text); // fallback: raw text
      }
    });

    // Append JSON-only instruction and feed via stdin (no command-line length limit)
    const full = prompt + "\n\nRespond ONLY with raw JSON — no markdown fences, no extra text.";
    child.stdin?.write(full);
    child.stdin?.end();

    // 3-minute safety timeout
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("claude CLI excedeu o tempo limite (3 min)"));
    }, 3 * 60 * 1000);

    child.on("close", () => clearTimeout(timer));
  });
}

export const auditModel: AuditModel = {
  async generateReport(prompt: string): Promise<unknown> {
    const text = await runClaudeCli(prompt);

    let clean = text.trim();
    if (clean.startsWith("```")) {
      clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    }

    return JSON.parse(clean);
  },
};
