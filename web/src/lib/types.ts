export interface Page {
  url: string;
  title: string;
  meta: string;
  h1: string;
  text: string;
  word_count: number;
}

export interface Corpus {
  pages: Page[];
  total_rows: number;
  skipped_rows: number;
}

export interface OverlapPair {
  a: string; // url a
  b: string; // url b
  score: number; // cosine similarity in [0, 1]
}

export interface OverlapReport {
  pairs: OverlapPair[];
  compared: number; // page pairs compared = n*(n-1)/2
}

// Slice 3 audit contract (validation source lives in ./audit/schema).
export type { AuditItem, AuditReport, AuditResponse } from "./audit/schema";

// Cross-site competitive analysis types (mirrored from wasm-core/src/types.rs).
export interface CrossPair {
  a_url: string;
  b_url: string;
  score: number;
}

export interface GapTerm {
  term: string;
  b_weight: number;
  a_weight: number;
}

export interface ComparisonReport {
  overlaps: CrossPair[];
  gaps: GapTerm[];
  compared: number;
}
