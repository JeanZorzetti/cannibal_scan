pub mod compare;
pub mod overlaps;
pub mod parser;
pub mod types;

use wasm_bindgen::prelude::*;

/// Thin WASM<->JS edge: parse CSV bytes and return the Corpus as a JS object.
/// Errors surface as a JS string (e.g. "MissingUrlColumn").
#[wasm_bindgen]
pub fn parse_corpus_json(csv_bytes: &[u8]) -> Result<JsValue, JsValue> {
    let corpus =
        parser::parse_corpus(csv_bytes).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    serde_wasm_bindgen::to_value(&corpus).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Thin WASM<->JS edge: parse CSV bytes, run the cannibalization scan at the
/// given cosine threshold, and return the OverlapReport as a JS object. Re-parses
/// internally so the JS side never has to round-trip a Corpus back into WASM.
#[wasm_bindgen]
pub fn find_overlaps_json(csv_bytes: &[u8], threshold: f64) -> Result<JsValue, JsValue> {
    let corpus =
        parser::parse_corpus(csv_bytes).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    let report = overlaps::find_overlaps(&corpus, threshold);
    serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Cross-site competitive analysis: parse two CSV crawls (site A = yours, site B =
/// competitor), compute bipartite cosine overlaps (A×B) and content gaps (terms
/// strong in B but weak in A), and return a ComparisonReport as a JS object.
#[wasm_bindgen]
pub fn compare_sites_json(
    csv_a: &[u8],
    csv_b: &[u8],
    threshold: f64,
    gap_top_n: usize,
) -> Result<JsValue, JsValue> {
    let corpus_a =
        parser::parse_corpus(csv_a).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    let corpus_b =
        parser::parse_corpus(csv_b).map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
    let report = compare::compare_sites(&corpus_a, &corpus_b, threshold, gap_top_n);
    serde_wasm_bindgen::to_value(&report).map_err(|e| JsValue::from_str(&e.to_string()))
}
