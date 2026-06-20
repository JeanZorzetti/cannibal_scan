use cannibalscan_wasm_core::compare::compare_sites;
use cannibalscan_wasm_core::types::{Corpus, Page};

fn page(url: &str, title: &str, h1: &str, meta: &str, text: &str) -> Page {
    Page {
        url: url.to_string(),
        title: title.to_string(),
        h1: h1.to_string(),
        meta: meta.to_string(),
        text: text.to_string(),
        word_count: text.split_whitespace().count(),
    }
}

fn corpus(pages: Vec<Page>) -> Corpus {
    let total = pages.len();
    Corpus { pages, total_rows: total, skipped_rows: 0 }
}

#[test]
fn matching_pages_score_high() {
    let a = corpus(vec![page("https://a.com/reviews", "Review Software", "Review Software", "", "collect manage customer reviews online")]);
    let b = corpus(vec![page("https://b.com/reviews", "Review Software", "Review Software", "", "collect manage customer reviews online platform")]);
    let report = compare_sites(&a, &b, 0.7, 10);
    assert_eq!(report.overlaps.len(), 1);
    assert!(report.overlaps[0].score >= 0.7, "score was {}", report.overlaps[0].score);
    assert_eq!(report.overlaps[0].a_url, "https://a.com/reviews");
    assert_eq!(report.overlaps[0].b_url, "https://b.com/reviews");
}

#[test]
fn disjoint_sites_no_overlap() {
    let a = corpus(vec![page("https://a.com", "Running Shoes", "Running Shoes", "", "marathon training gear athletes")]);
    let b = corpus(vec![page("https://b.com", "Tax Software", "Tax Software", "", "file income return online")]);
    let report = compare_sites(&a, &b, 0.7, 10);
    assert!(report.overlaps.is_empty(), "expected no overlaps, got {:?}", report.overlaps);
}

#[test]
fn compared_equals_na_times_nb() {
    let a = corpus(vec![
        page("https://a.com/1", "A1", "A1", "", "alpha beta"),
        page("https://a.com/2", "A2", "A2", "", "gamma delta"),
    ]);
    let b = corpus(vec![
        page("https://b.com/1", "B1", "B1", "", "epsilon zeta"),
        page("https://b.com/2", "B2", "B2", "", "eta theta"),
        page("https://b.com/3", "B3", "B3", "", "iota kappa"),
    ]);
    let report = compare_sites(&a, &b, 0.0, 10);
    assert_eq!(report.compared, 6, "expected 2*3=6, got {}", report.compared);
}

#[test]
fn gaps_contain_strong_b_terms() {
    // Site A talks about "shoes"; site B also talks about "shoes" but heavily about "warranty".
    let a = corpus(vec![page("https://a.com", "Shoes", "Shoes", "", "buy shoes running shoes sports shoes")]);
    let b = corpus(vec![page("https://b.com", "Shoes Warranty", "Shoes Warranty", "", "buy shoes running shoes sports shoes warranty warranty warranty")]);
    let report = compare_sites(&a, &b, 0.0, 20);
    let gap_terms: Vec<&str> = report.gaps.iter().map(|g| g.term.as_str()).collect();
    assert!(gap_terms.contains(&"warranty"), "expected 'warranty' in gaps, got {:?}", gap_terms);
}

#[test]
fn overlaps_sorted_by_score_desc() {
    let a = corpus(vec![
        page("https://a.com/1", "Common Topic", "Common Topic", "", "foo bar baz qux"),
        page("https://a.com/2", "Slightly different", "Slightly different", "", "foo bar quux"),
    ]);
    let b = corpus(vec![page("https://b.com/1", "Common Topic", "Common Topic", "", "foo bar baz qux quux")]);
    let report = compare_sites(&a, &b, 0.0, 10);
    for w in report.overlaps.windows(2) {
        assert!(w[0].score >= w[1].score, "not sorted: {} < {}", w[0].score, w[1].score);
    }
}
