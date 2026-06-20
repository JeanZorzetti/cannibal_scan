export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { crawlSite } from "@/lib/crawl/crawler";

const MAX_PAGES_HARD_LIMIT = 1000;

export async function POST(req: NextRequest) {
  let body: { url?: string; maxPages?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Corpo JSON inválido" }), { status: 400 });
  }

  const { url, maxPages = 200 } = body;

  if (!url || typeof url !== "string") {
    return new Response(JSON.stringify({ error: "Campo 'url' obrigatório" }), { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: "URL inválida" }), { status: 400 });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return new Response(JSON.stringify({ error: "Apenas http/https são suportados" }), { status: 400 });
  }

  const limit = Math.min(Math.max(1, Number(maxPages) || 200), MAX_PAGES_HARD_LIMIT);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      try {
        const rows = await crawlSite({
          startUrl: url,
          maxPages: limit,
          onProgress: (p) => {
            enqueue({ type: "progress", done: p.done, found: p.found, url: p.url });
          },
        });

        enqueue({ type: "done", rows });
      } catch (e) {
        enqueue({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
