"use client";
import { useState } from "react";
import { useSiteSource } from "@/lib/crawl/useSiteSource";
import { SiteSourcePanel } from "@/components/SiteSourcePanel";
import { compareSites } from "@/lib/wasm";
import { siteMetrics } from "@/lib/compare/metrics";
import type { ComparisonReport } from "@/lib/types";
import type { CompareResponse } from "@/lib/compare/schema";

export default function ComparePage() {
  const siteA = useSiteSource();
  const siteB = useSiteSource();

  const [threshold, setThreshold] = useState(0.5);
  const [gapTopN] = useState(30);
  const [comparing, setComparing] = useState(false);
  const [report, setReport] = useState<ComparisonReport | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const [auditBusy, setAuditBusy] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [audit, setAudit] = useState<CompareResponse | null>(null);

  const bothReady = siteA.corpus && siteB.corpus && siteA.bytes && siteB.bytes;

  async function handleCompare() {
    if (!siteA.bytes || !siteB.bytes) return;
    setComparing(true);
    setCompareError(null);
    setReport(null);
    setAudit(null);
    setAuditError(null);
    try {
      const r = await compareSites(siteA.bytes, siteB.bytes, threshold, gapTopN);
      setReport(r);
    } catch (e) {
      setCompareError(e instanceof Error ? e.message : String(e));
    } finally {
      setComparing(false);
    }
  }

  async function handleAudit() {
    if (!report || !siteA.corpus || !siteB.corpus) return;
    setAuditBusy(true);
    setAuditError(null);
    setAudit(null);
    try {
      const res = await fetch("/api/compare-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, corpusA: siteA.corpus, corpusB: siteB.corpus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setAudit((await res.json()) as CompareResponse);
    } catch (e) {
      setAuditError(e instanceof Error ? e.message : String(e));
    } finally {
      setAuditBusy(false);
    }
  }

  const metricsA = siteA.corpus ? siteMetrics(siteA.corpus) : null;
  const metricsB = siteB.corpus ? siteMetrics(siteB.corpus) : null;

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-2 text-2xl font-bold">Comparar 2 sites</h1>
      <p className="mb-8 text-sm text-gray-500">
        Analise onde seu site compete com um concorrente e onde está ficando para trás.
      </p>

      {/* ── Site inputs ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 mb-8">
        <SiteSourcePanel source={siteA} label="Seu site (a melhorar)" />
        <SiteSourcePanel source={siteB} label="Site de referência (concorrente)" />
      </div>

      {/* ── Compare controls ── */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Similaridade mínima
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
          <span className="w-10 font-mono tabular-nums">{threshold.toFixed(2)}</span>
        </label>
        <button
          type="button"
          onClick={handleCompare}
          disabled={!bothReady || comparing}
          className="rounded-md bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
        >
          {comparing ? "Comparando…" : "Comparar sites"}
        </button>
      </div>

      {compareError && (
        <p className="mb-6 text-sm text-red-600">Erro: {compareError}</p>
      )}

      {/* ── Metrics side by side ── */}
      {metricsA && metricsB && report && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Métricas comparadas</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-6 text-gray-500">Métrica</th>
                  <th className="py-2 pr-6 text-blue-700">Seu site</th>
                  <th className="py-2 text-orange-700">Concorrente</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Páginas", metricsA.pages, metricsB.pages],
                  ["Palavras médias/página", metricsA.avgWords, metricsB.avgWords],
                  ["% com Title", `${metricsA.pctWithTitle}%`, `${metricsB.pctWithTitle}%`],
                  ["% com Meta description", `${metricsA.pctWithMeta}%`, `${metricsB.pctWithMeta}%`],
                  ["% com H1", `${metricsA.pctWithH1}%`, `${metricsB.pctWithH1}%`],
                ].map(([label, a, b]) => (
                  <tr key={String(label)} className="border-b">
                    <td className="py-2 pr-6 text-gray-600">{label}</td>
                    <td className="py-2 pr-6 font-medium text-blue-700">{String(a)}</td>
                    <td className="py-2 font-medium text-orange-700">{String(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Overlaps ── */}
      {report && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">
            Sobreposição de conteúdo
            <span className="ml-2 text-sm font-normal text-gray-500">
              {report.overlaps.length} par(es) · {report.compared} comparações
            </span>
          </h2>
          {report.overlaps.length > 0 ? (
            <ul className="space-y-1">
              {report.overlaps.map((pair) => (
                <li key={`${pair.a_url}|${pair.b_url}`} className="flex flex-wrap items-center gap-3 border-b py-1.5 text-sm">
                  <span className="font-mono tabular-nums text-red-600 w-12">{pair.score.toFixed(2)}</span>
                  <span className="text-blue-700 break-all">{pair.a_url}</span>
                  <span className="text-gray-400">↔</span>
                  <span className="text-orange-600 break-all">{pair.b_url}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Nenhum par acima do limiar — tente reduzir a similaridade mínima.</p>
          )}
        </section>
      )}

      {/* ── Gaps ── */}
      {report && report.gaps.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Lacunas de conteúdo</h2>
          <p className="mb-3 text-sm text-gray-500">
            Termos que o concorrente enfatiza e seu site quase não cobre.
          </p>
          <div className="flex flex-wrap gap-2">
            {report.gaps.map((g) => (
              <span
                key={g.term}
                title={`Concorrente: ${g.b_weight.toFixed(3)} · Seu site: ${g.a_weight.toFixed(3)}`}
                className="rounded-full bg-orange-100 px-3 py-1 text-xs text-orange-800"
              >
                {g.term}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── AI Audit ── */}
      {report && (report.overlaps.length > 0 || report.gaps.length > 0) && (
        <section className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">Recomendações de melhoria (IA)</h2>
            <button
              type="button"
              onClick={handleAudit}
              disabled={auditBusy}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {auditBusy ? "Analisando…" : "Recomendar melhorias"}
            </button>
          </div>

          {auditError && (
            <p className="mb-3 text-sm text-red-600">
              Auditoria indisponível: {auditError} (os resultados acima continuam válidos)
            </p>
          )}

          {audit && (
            <>
              <ul className="space-y-3">
                {audit.recommendations.map((rec, i) => (
                  <li key={i} className="rounded-lg border p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs text-blue-800">
                        prioridade {rec.priority}
                      </span>
                      <span className="font-semibold">{rec.title}</span>
                    </div>
                    <p className="mb-1 text-gray-800">{rec.action}</p>
                    {rec.target_pages.length > 0 && (
                      <p className="mt-1 text-xs">
                        <span className="text-gray-500">Páginas alvo: </span>
                        {rec.target_pages.map((u, j) => (
                          <span key={u}>{j > 0 && ", "}<span className="text-blue-700">{u}</span></span>
                        ))}
                      </p>
                    )}
                    {rec.reference_pages.length > 0 && (
                      <p className="mt-1 text-xs">
                        <span className="text-gray-500">Referência: </span>
                        {rec.reference_pages.map((u, j) => (
                          <span key={u}>{j > 0 && ", "}<span className="text-orange-600">{u}</span></span>
                        ))}
                      </p>
                    )}
                    <p className="mt-2 text-gray-600">{rec.rationale}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-gray-400">modelo: {audit.model}</p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
