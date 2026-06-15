use crate::types::{Corpus, OverlapPair, OverlapReport, Page};
use std::collections::HashMap;

/// Lowercase, split on any non-alphanumeric char, drop empty tokens.
fn tokenize(s: &str) -> impl Iterator<Item = String> + '_ {
    s.split(|c: char| !c.is_alphanumeric())
        .filter(|t| !t.is_empty())
        .map(|t| t.to_lowercase())
}

/// Bag of tokens for one page. Task 2: every field contributes with equal weight.
fn page_tokens(page: &Page) -> Vec<String> {
    let mut bag = Vec::new();
    for field in [&page.title, &page.h1, &page.meta, &page.text] {
        bag.extend(tokenize(field));
    }
    bag
}

/// A page's TF-IDF vector (sparse) plus its precomputed L2 norm.
struct DocVector {
    weights: HashMap<String, f64>,
    norm: f64,
}

fn cosine(a: &DocVector, b: &DocVector) -> f64 {
    if a.norm == 0.0 || b.norm == 0.0 {
        return 0.0;
    }
    // Iterate the smaller map and probe the larger one.
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

/// Find pairs of pages whose cosine similarity (over weighted TF-IDF of their
/// text) is `>= threshold`. Pure O(n²); returns pairs sorted by score desc.
pub fn find_overlaps(corpus: &Corpus, threshold: f64) -> OverlapReport {
    let n = corpus.pages.len();

    // 1. Term frequency per page (over the weighted token bag).
    let tfs: Vec<HashMap<String, f64>> = corpus
        .pages
        .iter()
        .map(|p| {
            let mut tf: HashMap<String, f64> = HashMap::new();
            for tok in page_tokens(p) {
                *tf.entry(tok).or_insert(0.0) += 1.0;
            }
            tf
        })
        .collect();

    // 2. Document frequency: how many pages contain each term.
    let mut df: HashMap<&str, usize> = HashMap::new();
    for tf in &tfs {
        for term in tf.keys() {
            *df.entry(term.as_str()).or_insert(0) += 1;
        }
    }

    // 3. Smoothed IDF (sklearn-style) keeps shared terms non-zero even when a
    //    term appears in every page — exactly the cannibalization case.
    let nf = n as f64;
    let vectors: Vec<DocVector> = tfs
        .iter()
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
        .collect();

    // 4. Pairwise cosine over the upper triangle.
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
