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
