use crate::overlaps::{build_vectors, cosine, page_tf};
use crate::types::{ComparisonReport, Corpus, CrossPair, GapTerm};
use std::collections::HashMap;

/// Cross-site competitive analysis:
/// - overlaps: pairs (a_page, b_page) with cosine >= threshold, sorted by score desc.
/// - gaps: top `gap_top_n` terms where site B has strong presence and site A is weak.
///
/// IDF is computed over the *union* of both corpora so the scoring is consistent.
pub fn compare_sites(a: &Corpus, b: &Corpus, threshold: f64, gap_top_n: usize) -> ComparisonReport {
    let na = a.pages.len();
    let nb = b.pages.len();

    // TF for every page in both corpora.
    let tfs_a: Vec<HashMap<String, f64>> = a.pages.iter().map(page_tf).collect();
    let tfs_b: Vec<HashMap<String, f64>> = b.pages.iter().map(page_tf).collect();

    // DF over the union so the IDF denominator is shared.
    let n_union = na + nb;
    let mut df: HashMap<String, usize> = HashMap::new();
    for tf in tfs_a.iter().chain(tfs_b.iter()) {
        for term in tf.keys() {
            *df.entry(term.clone()).or_insert(0) += 1;
        }
    }

    let vecs_a = build_vectors(&tfs_a, &df, n_union);
    let vecs_b = build_vectors(&tfs_b, &df, n_union);

    // ── Overlaps: bipartite A×B ──────────────────────────────────────────────
    let mut overlaps: Vec<CrossPair> = Vec::new();
    for (i, va) in vecs_a.iter().enumerate() {
        for (j, vb) in vecs_b.iter().enumerate() {
            let score = cosine(va, vb);
            if score >= threshold {
                overlaps.push(CrossPair {
                    a_url: a.pages[i].url.clone(),
                    b_url: b.pages[j].url.clone(),
                    score,
                });
            }
        }
    }
    overlaps.sort_by(|x, y| y.score.partial_cmp(&x.score).unwrap_or(std::cmp::Ordering::Equal));

    // ── Gaps: aggregate TF-IDF weight per term across each corpus ────────────
    // Sum the TF-IDF weights for each term across all pages of each side.
    let sum_weights = |vecs: &[crate::overlaps::DocVector]| {
        let mut agg: HashMap<String, f64> = HashMap::new();
        for v in vecs {
            for (term, &w) in &v.weights {
                *agg.entry(term.clone()).or_insert(0.0) += w;
            }
        }
        agg
    };

    let agg_a = sum_weights(&vecs_a);
    let agg_b = sum_weights(&vecs_b);

    // Normalise by corpus size so larger sites don't dominate.
    let norm_a = na.max(1) as f64;
    let norm_b = nb.max(1) as f64;

    // All terms present in B — compute gap score = b_avg - a_avg.
    let mut gap_terms: Vec<GapTerm> = agg_b
        .iter()
        .map(|(term, &bw)| {
            let b_avg = bw / norm_b;
            let a_avg = agg_a.get(term).copied().unwrap_or(0.0) / norm_a;
            GapTerm {
                term: term.clone(),
                b_weight: b_avg,
                a_weight: a_avg,
            }
        })
        .filter(|g| g.b_weight > g.a_weight)
        .collect();

    gap_terms.sort_by(|x, y| {
        let gap_x = x.b_weight - x.a_weight;
        let gap_y = y.b_weight - y.a_weight;
        gap_y.partial_cmp(&gap_x).unwrap_or(std::cmp::Ordering::Equal)
    });
    gap_terms.truncate(gap_top_n);

    ComparisonReport {
        overlaps,
        gaps: gap_terms,
        compared: na * nb,
    }
}
