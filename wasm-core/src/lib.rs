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
