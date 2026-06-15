// Built into the web tree (see wasm-core build step) so Turbopack resolves it
// inside the project root instead of through an out-of-root junction.
import init, {
  parse_corpus_json,
  find_overlaps_json,
} from "@/wasm/cannibalscan_wasm_core.js";
import type { Corpus, OverlapReport } from "./types";

// Instantiate the WASM module once, then reuse it. `init()` (web target) fetches
// the _bg.wasm asset via import.meta.url, which both Turbopack and webpack emit.
let ready: Promise<unknown> | null = null;

export async function parseCsv(bytes: Uint8Array): Promise<Corpus> {
  if (!ready) ready = init();
  await ready;
  return parse_corpus_json(bytes) as Corpus;
}

// Parse + run the O(n²) cannibalization scan at the given cosine threshold.
export async function findOverlaps(
  bytes: Uint8Array,
  threshold: number,
): Promise<OverlapReport> {
  if (!ready) ready = init();
  await ready;
  return find_overlaps_json(bytes, threshold) as OverlapReport;
}
