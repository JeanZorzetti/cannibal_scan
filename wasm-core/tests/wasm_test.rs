#![cfg(target_arch = "wasm32")]

use cannibalscan_wasm_core::parse_corpus_json;
use wasm_bindgen_test::*;

#[wasm_bindgen_test]
fn wasm_parse_returns_ok_for_valid_csv() {
    let csv = b"Address,Content\nhttps://a.com,hello world\n";
    assert!(parse_corpus_json(csv).is_ok());
}

#[wasm_bindgen_test]
fn wasm_parse_returns_err_for_missing_url() {
    let csv = b"Title 1,Content\nPage,hello\n";
    assert!(parse_corpus_json(csv).is_err());
}
