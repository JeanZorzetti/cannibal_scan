"use client";
import { useState } from "react";
import { parseCsv } from "@/lib/wasm";
import type { Corpus } from "@/lib/types";

export default function Home() {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setCorpus(await parseCsv(bytes));
    } catch (e) {
      setCorpus(null);
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-4 text-2xl font-bold">CannibalScan — Slice 1</h1>

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
    </main>
  );
}
