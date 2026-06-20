"use client";
import type { SiteSource } from "@/lib/crawl/useSiteSource";

interface Props {
  source: SiteSource;
  label?: string;
}

export function SiteSourcePanel({ source, label }: Props) {
  const { status, crawlUrl, crawlMaxPages, csvBlob, corpus } = source;
  const busy = status.kind === "crawling" || status.kind === "busy";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      {label && <h3 className="mb-3 text-base font-semibold">{label}</h3>}

      {/* Crawl inputs */}
      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div className="flex-1 min-w-52">
          <label className="mb-1 block text-xs font-medium text-gray-700">URL do site</label>
          <input
            type="url"
            placeholder="https://exemplo.com.br"
            value={crawlUrl}
            onChange={(e) => source.setCrawlUrl(e.target.value)}
            disabled={busy}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          />
        </div>
        <div className="w-32">
          <label className="mb-1 block text-xs font-medium text-gray-700">Máx. páginas</label>
          <input
            type="number"
            min={1}
            max={1000}
            value={crawlMaxPages}
            onChange={(e) => source.setCrawlMaxPages(Number(e.target.value))}
            disabled={busy}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
          />
        </div>
        <button
          type="button"
          onClick={source.handleCrawl}
          disabled={busy || !crawlUrl.trim()}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {busy ? "Rastreando…" : "Rastrear"}
        </button>
        {busy && (
          <button
            type="button"
            onClick={source.stopCrawl}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Parar
          </button>
        )}
      </div>

      {/* Progress */}
      {status.kind === "crawling" && (
        <p className="mb-2 text-xs text-gray-500">
          {status.done} coletadas · {status.found} encontradas
          {status.url && (
            <span className="ml-2 truncate max-w-[200px] inline-block align-bottom text-gray-400">
              {status.url}
            </span>
          )}
        </p>
      )}

      {/* Divider */}
      <div className="relative my-3">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center"><span className="bg-gray-50 px-2 text-xs text-gray-400">ou CSV</span></div>
      </div>

      {/* Drop zone */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) source.handleFile(f); }}
        className="block cursor-pointer rounded-md border-2 border-dashed border-gray-300 px-4 py-5 text-center text-xs text-gray-500 hover:bg-gray-100"
      >
        Arraste um CSV ou clique para escolher
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) source.handleFile(f); }}
        />
      </label>

      {/* Status / result summary */}
      {status.kind === "error" && (
        <p className="mt-2 text-xs text-red-600">Erro: {status.message}</p>
      )}
      {status.kind === "busy" && (
        <p className="mt-2 text-xs text-gray-500">{status.label}</p>
      )}
      {corpus && status.kind === "ready" && (
        <div className="mt-2 flex items-center gap-3">
          <p className="text-xs text-green-700 font-medium">
            {corpus.pages.length} páginas carregadas
          </p>
          {csvBlob && (
            <button
              type="button"
              onClick={source.downloadCsv}
              className="text-xs text-gray-500 underline"
            >
              ↓ Baixar CSV
            </button>
          )}
          <button
            type="button"
            onClick={source.reset}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Limpar
          </button>
        </div>
      )}
    </div>
  );
}
