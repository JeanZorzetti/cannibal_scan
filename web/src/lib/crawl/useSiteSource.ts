"use client";
import { useRef, useState } from "react";
import { parseCsv } from "@/lib/wasm";
import { toCannibalCsv } from "@/lib/crawl/csv";
import type { CrawledPage } from "@/lib/crawl/csv";
import type { Corpus } from "@/lib/types";

export type SiteSourceStatus =
  | { kind: "idle" }
  | { kind: "busy"; label: string }
  | { kind: "crawling"; done: number; found: number; url: string }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export interface SiteSource {
  corpus: Corpus | null;
  bytes: Uint8Array | null;
  csvBlob: Blob | null;
  status: SiteSourceStatus;
  crawlUrl: string;
  crawlMaxPages: number;
  setCrawlUrl: (v: string) => void;
  setCrawlMaxPages: (v: number) => void;
  handleFile: (file: File) => Promise<void>;
  handleCrawl: () => Promise<void>;
  stopCrawl: () => void;
  downloadCsv: () => void;
  reset: () => void;
}

export function useSiteSource(): SiteSource {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [csvBlob, setCsvBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<SiteSourceStatus>({ kind: "idle" });
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlMaxPages, setCrawlMaxPages] = useState(200);
  const abortRef = useRef<AbortController | null>(null);

  async function loadBytes(b: Uint8Array) {
    setStatus({ kind: "busy", label: "Processando…" });
    try {
      const c = await parseCsv(b);
      setCorpus(c);
      setBytes(b);
      setStatus({ kind: "ready" });
    } catch (e) {
      setStatus({ kind: "error", message: String(e) });
    }
  }

  async function handleFile(file: File) {
    setCsvBlob(null);
    setCorpus(null);
    setBytes(null);
    const b = new Uint8Array(await file.arrayBuffer());
    await loadBytes(b);
  }

  async function handleCrawl() {
    if (!crawlUrl.trim()) return;
    setCorpus(null);
    setBytes(null);
    setCsvBlob(null);
    const abort = new AbortController();
    abortRef.current = abort;
    setStatus({ kind: "crawling", done: 0, found: 0, url: "" });

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl.trim(), maxPages: crawlMaxPages }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let msg: { type: string; done?: number; found?: number; url?: string; rows?: CrawledPage[]; message?: string };
          try { msg = JSON.parse(line); } catch { continue; }

          if (msg.type === "progress") {
            setStatus({ kind: "crawling", done: msg.done ?? 0, found: msg.found ?? 0, url: msg.url ?? "" });
          } else if (msg.type === "done" && msg.rows) {
            const csv = toCannibalCsv(msg.rows);
            const blob = new Blob([csv], { type: "text/csv" });
            setCsvBlob(blob);
            await loadBytes(new TextEncoder().encode(csv));
          } else if (msg.type === "error") {
            throw new Error(msg.message ?? "Erro desconhecido no crawl");
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setStatus({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      } else {
        setStatus({ kind: "idle" });
      }
    }
  }

  function stopCrawl() {
    abortRef.current?.abort();
  }

  function downloadCsv() {
    if (!csvBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(csvBlob);
    a.download = "crawl.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function reset() {
    abortRef.current?.abort();
    setCorpus(null);
    setBytes(null);
    setCsvBlob(null);
    setStatus({ kind: "idle" });
  }

  return {
    corpus, bytes, csvBlob, status,
    crawlUrl, crawlMaxPages,
    setCrawlUrl, setCrawlMaxPages,
    handleFile, handleCrawl, stopCrawl, downloadCsv, reset,
  };
}
