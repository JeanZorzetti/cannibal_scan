use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Page {
    pub url: String,
    pub title: String,
    pub meta: String,
    pub h1: String,
    pub text: String,
    pub word_count: usize,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Corpus {
    pub pages: Vec<Page>,
    pub total_rows: usize,
    pub skipped_rows: usize,
}

/// A pair of pages whose content similarity is high enough to compete (cannibalize).
/// `a`/`b` are the page URLs; `score` is the cosine similarity in [0, 1].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OverlapPair {
    pub a: String,
    pub b: String,
    pub score: f64,
}

/// Result of a cannibalization scan: the pairs above threshold (sorted by score
/// desc) plus how many page pairs were compared (`n*(n-1)/2`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OverlapReport {
    pub pairs: Vec<OverlapPair>,
    pub compared: usize,
}

/// A pair of pages from two *different* sites whose content similarity is high
/// enough to indicate competitive overlap.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CrossPair {
    pub a_url: String, // page from site A (your site)
    pub b_url: String, // page from site B (competitor)
    pub score: f64,
}

/// A term/topic that site B covers strongly but site A barely covers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GapTerm {
    pub term: String,
    pub b_weight: f64,
    pub a_weight: f64,
}

/// Result of a cross-site competitive comparison.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComparisonReport {
    pub overlaps: Vec<CrossPair>,
    pub gaps: Vec<GapTerm>,
    pub compared: usize, // len(a) * len(b)
}
