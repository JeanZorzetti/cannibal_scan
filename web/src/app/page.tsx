"use client";
import { useEffect, useState } from "react";
import { parseCsv, findOverlaps } from "@/lib/wasm";
import type { Corpus, OverlapReport, AuditResponse } from "@/lib/types";

export default function Home() {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [report, setReport] = useState<OverlapReport | null>(null);
  const [threshold, setThreshold] = useState(0.7);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Slice 3 — prioritized audit from the Mastra agent.
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const b = new Uint8Array(await file.arrayBuffer());
      setCorpus(await parseCsv(b));
      setBytes(b); // triggers the overlap scan via the effect below
    } catch (e) {
      setCorpus(null);
      setBytes(null);
      setReport(null);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Re-run the cannibalization scan whenever the file or threshold changes. Any
  // prior audit is stale once the pairs change, so clear it.
  useEffect(() => {
    if (!bytes) return;
    setAudit(null);
    setAuditError(null);
    let cancelled = false;
    findOverlaps(bytes, threshold)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [bytes, threshold]);

  // Send the pairs (+ trimmed page metadata for the clustered URLs) to the agent.
  async function requestAudit() {
    if (!report || !corpus) return;
    setAuditBusy(true);
    setAuditError(null);
    setAudit(null);
    try {
      const pairUrls = new Set(report.pairs.flatMap((p) => [p.a, p.b]));
      const pages = corpus.pages
        .filter((p) => pairUrls.has(p.url))
        .map(({ url, title, h1, meta }) => ({ url, title, h1, meta }));
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, pages }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setAudit((await res.json()) as AuditResponse);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuditBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-4 text-2xl font-bold">CannibalScan — Slice 3</h1>

      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-400 p-10 text-center text-gray-600 hover:bg-gray-50"
      >
        Arraste um CSV de crawl aqui, ou clique pra escolher
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {busy && <p className="mt-4">Processando…</p>}
      {error && (
        <p className="mt-4 text-red-600" data-testid="error">
          Erro: {error}
        </p>
      )}

      {corpus && (
        <section className="mt-6" data-testid="results">
          <p className="mb-3 text-sm text-gray-700" data-testid="summary">
            {corpus.pages.length} páginas · {corpus.total_rows} linhas lidas ·{" "}
            {corpus.skipped_rows} puladas
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4">URL</th>
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Palavras</th>
                </tr>
              </thead>
              <tbody>
                {corpus.pages.slice(0, 200).map((p) => (
                  <tr key={p.url} className="border-b">
                    <td className="py-1 pr-4 text-blue-700">{p.url}</td>
                    <td className="py-1 pr-4">{p.title}</td>
                    <td className="py-1 pr-4">{p.word_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {corpus && (
        <section className="mt-8" data-testid="overlaps">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Canibalização</h2>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Similaridade mínima
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={threshold}
                data-testid="threshold"
                onChange={(e) => setThreshold(Number(e.target.value))}
              />
              <span className="w-10 font-mono tabular-nums">
                {threshold.toFixed(2)}
              </span>
            </label>
          </div>

          {report && (
            <p className="mb-3 text-sm text-gray-700" data-testid="overlaps-summary">
              {report.pairs.length} par(es) canibalizando · {report.compared}{" "}
              comparações
            </p>
          )}

          {report && report.pairs.length > 0 ? (
            <ul className="space-y-1">
              {report.pairs.map((p) => (
                <li
                  key={`${p.a}|${p.b}`}
                  data-testid="overlap-row"
                  className="flex items-center gap-3 border-b py-1 text-sm"
                >
                  <span className="font-mono tabular-nums text-red-600">
                    {p.score.toFixed(2)}
                  </span>
                  <span className="text-blue-700">{p.a}</span>
                  <span className="text-gray-400">↔</span>
                  <span className="text-blue-700">{p.b}</span>
                </li>
              ))}
            </ul>
          ) : (
            report && (
              <p className="text-sm text-gray-500">
                Nenhum par acima do limiar.
              </p>
            )
          )}
        </section>
      )}

      {report && report.pairs.length > 0 && (
        <section className="mt-8" data-testid="audit-section">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Auditoria priorizada</h2>
            <button
              type="button"
              data-testid="audit-btn"
              onClick={requestAudit}
              disabled={auditBusy}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              Explicar/recomendar
            </button>
            {auditBusy && (
              <span className="text-sm text-gray-600" data-testid="audit-busy">
                Analisando…
              </span>
            )}
          </div>

          {auditError && (
            <p className="mb-3 text-sm text-red-600" data-testid="audit-error">
              Auditoria indisponível: {auditError} (os pares acima continuam válidos)
            </p>
          )}

          {audit && (
            <>
              <ul className="space-y-3" data-testid="audit">
                {audit.items.map((item) => (
                  <li
                    key={item.keep}
                    data-testid="audit-row"
                    className="rounded-lg border p-4 text-sm"
                  >
                    <div className="mb-2">
                      <span className="rounded bg-amber-100 px-2 py-0.5 font-mono text-xs text-amber-800">
                        prioridade {item.priority}
                      </span>
                    </div>
                    <p>
                      <span className="text-gray-500">Manter (canônica): </span>
                      <span className="font-medium text-green-700">
                        {item.keep}
                      </span>
                    </p>
                    {item.merge_or_redirect.length > 0 && (
                      <p className="mt-1">
                        <span className="text-gray-500">
                          Fundir/redirecionar:{" "}
                        </span>
                        {item.merge_or_redirect.map((u, i) => (
                          <span key={u}>
                            {i > 0 && ", "}
                            <span className="text-red-600 line-through">{u}</span>
                          </span>
                        ))}
                      </p>
                    )}
                    <p className="mt-2">
                      <span className="text-gray-500">Título: </span>
                      {item.consolidated_title}
                    </p>
                    <p>
                      <span className="text-gray-500">Meta: </span>
                      {item.consolidated_meta}
                    </p>
                    <p className="mt-2 text-gray-600">{item.rationale}</p>
                  </li>
                ))}
              </ul>
              <p
                className="mt-2 text-xs text-gray-400"
                data-testid="audit-model"
              >
                modelo: {audit.model}
              </p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
