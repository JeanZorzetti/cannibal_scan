use crate::types::{Corpus, OverlapPair, OverlapReport, Page};
use std::collections::HashMap;

// Field weights: SEO cannibalization is driven more by title/h1 intent than by
// body copy. A token's field weight is how many times it enters the TF bag.
const TITLE_WEIGHT: usize = 3;
const H1_WEIGHT: usize = 2;
const META_WEIGHT: usize = 1;
const TEXT_WEIGHT: usize = 1;

/// Lowercase, split on any non-alphanumeric char, drop empty tokens.
pub fn tokenize(s: &str) -> impl Iterator<Item = String> + '_ {
    s.split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_lowercase())
}

/// Weighted bag of tokens for one page: each field's tokens are repeated by the
/// field weight, so title/h1 matches count more than body matches in the TF.
pub fn page_tokens(page: &Page) -> Vec<String> {
    let mut bag = Vec::new();
    let weighted = [
        (&page.title, TITLE_WEIGHT),
        (&page.h1, H1_WEIGHT),
        (&page.meta, META_WEIGHT),
        (&page.text, TEXT_WEIGHT),
    ];
    for (field, weight) in weighted {
        for tok in tokenize(field) {
            for _ in 0..weight {
                bag.push(tok.clone());
            }
        }
    }
    bag
}

/// A page's TF-IDF vector (sparse) plus its precomputed L2 norm.
pub struct DocVector {
    pub weights: HashMap<String, f64>,
    pub norm: f64,
}

pub fn cosine(a: &DocVector, b: &DocVector) -> f64 {
    if a.norm == 0.0 || b.norm == 0.0 {
        return 0.0;
    }
    let (small, large) = if a.weights.len() <= b.weights.len() {
        (a, b)
    } else {
        (b, a)
    };
    let mut dot = 0.0;
    for (term, &w) in &small.weights {
        if let Some(&w2) = large.weights.get(term) {
            dot += w * w2;
        }
    }
    dot / (a.norm * b.norm)
}

/// Compute TF (term frequency over the weighted token bag) for a single page.
pub fn page_tf(page: &Page) -> HashMap<String, f64> {
    let mut tf: HashMap<String, f64> = HashMap::new();
    for tok in page_tokens(page) {
        *tf.entry(tok).or_insert(0.0) += 1.0;
    }
    tf
}

/// Build TF-IDF DocVectors from pre-computed TFs and a DF map.
/// `n` is the total number of documents the IDF denominator is based on.
pub fn build_vectors(tfs: &[HashMap<String, f64>], df: &HashMap<String, usize>, n: usize) -> Vec<DocVector> {
    let nf = n as f64;
    tfs.iter()
        .map(|tf| {
            let mut weights = HashMap::with_capacity(tf.len());
            let mut norm_sq = 0.0;
            for (term, &freq) in tf {
                let dfi = *df.get(term.as_str()).unwrap_or(&1) as f64;
                let idf = ((nf + 1.0) / (dfi + 1.0)).ln() + 1.0;
                let w = freq * idf;
                norm_sq += w * w;
                weights.insert(term.clone(), w);
            }
            DocVector {
                weights,
                norm: norm_sq.sqrt(),
            }
        })
        .collect()
}

/// Find pairs of pages whose cosine similarity (over weighted TF-IDF of their
/// text) is `>= threshold`. Pure O(n²); returns pairs sorted by score desc.
pub fn find_overlaps(corpus: &Corpus, threshold: f64) -> OverlapReport {
    let n = corpus.pages.len();

    let tfs: Vec<HashMap<String, f64>> = corpus.pages.iter().map(page_tf).collect();

    let mut df: HashMap<String, usize> = HashMap::new();
    for tf in &tfs {
        for term in tf.keys() {
            *df.entry(term.clone()).or_insert(0) += 1;
        }
    }

    let vectors = build_vectors(&tfs, &df, n);

    let mut pairs = Vec::new();
    for i in 0..n {
        for j in (i + 1)..n {
            let score = cosine(&vectors[i], &vectors[j]);
            if score >= threshold {
                pairs.push(OverlapPair {
                    a: corpus.pages[i].url.clone(),
                    b: corpus.pages[j].url.clone(),
                    score,
                });
            }
        }
    }

    pairs.sort_by(|x, y| {
        y.score
            .partial_cmp(&x.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    OverlapReport {
        pairs,
        compared: n * n.saturating_sub(1) / 2,
    }
}
