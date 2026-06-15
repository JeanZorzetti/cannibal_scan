use cannibalscan_wasm_core::overlaps::find_overlaps;
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
    Corpus {
        pages,
        total_rows: total,
        skipped_rows: 0,
    }
}

#[test]
fn near_identical_pages_score_high() {
    let c = corpus(vec![
        page("https://a.com", "Best Running Shoes", "Best Running Shoes", "", "the best running shoes for marathon training"),
        page("https://b.com", "Best Running Shoes", "Best Running Shoes", "", "the best running shoes for marathon runners"),
    ]);
    let report = find_overlaps(&c, 0.7);
    assert_eq!(report.pairs.len(), 1);
    assert!(report.pairs[0].score >= 0.7, "score was {}", report.pairs[0].score);
}

#[test]
fn disparate_pages_no_overlap() {
    let c = corpus(vec![
        page("https://a.com", "Running Shoes", "Running Shoes", "", "marathon training gear for athletes"),
        page("https://b.com", "Tax Software", "Tax Software", "", "file your income return online quickly"),
    ]);
    let report = find_overlaps(&c, 0.7);
    assert!(report.pairs.is_empty(), "expected no overlaps, got {:?}", report.pairs);
}

#[test]
fn score_is_symmetric() {
    let a = page("https://a.com", "Blue Widgets", "Blue Widgets", "", "shop affordable blue widgets today");
    let b = page("https://b.com", "Blue Widgets", "Blue Widgets", "", "shop affordable blue widgets now");

    let forward = find_overlaps(&corpus(vec![a.clone(), b.clone()]), 0.0);
    let reverse = find_overlaps(&corpus(vec![b, a]), 0.0);

    assert_eq!(forward.pairs.len(), 1);
    assert_eq!(reverse.pairs.len(), 1);
    assert!(
        (forward.pairs[0].score - reverse.pairs[0].score).abs() < 1e-9,
        "{} vs {}",
        forward.pairs[0].score,
        reverse.pairs[0].score
    );
}

#[test]
fn weights_title_over_body() {
    // Two pages sharing ONLY the title (disjoint bodies)...
    let title_share = corpus(vec![
        page("https://a.com", "shared alpha beta", "", "", "uno dos tres"),
        page("https://b.com", "shared alpha beta", "", "", "cuatro cinco seis"),
    ]);
    // ...vs two pages sharing ONLY the body (disjoint titles), same shape.
    let body_share = corpus(vec![
        page("https://c.com", "tigre leon puma", "", "", "common gamma delta"),
        page("https://d.com", "aguila halcon cuervo", "", "", "common gamma delta"),
    ]);

    let title_score = find_overlaps(&title_share, 0.0).pairs[0].score;
    let body_score = find_overlaps(&body_share, 0.0).pairs[0].score;

    assert!(
        title_score > body_score,
        "title overlap ({title_score}) should outrank body overlap ({body_score})"
    );
}

#[test]
fn counts_compared_pairs() {
    let c = corpus(vec![
        page("https://a.com", "A", "A", "", "alpha"),
        page("https://b.com", "B", "B", "", "beta"),
        page("https://c.com", "C", "C", "", "gamma"),
    ]);
    let report = find_overlaps(&c, 0.7);
    assert_eq!(report.compared, 3); // 3*(3-1)/2
}
