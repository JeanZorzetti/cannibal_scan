use crate::types::{Corpus, Page};
use std::collections::HashSet;

const URL_HEADERS: &[&str] = &["address", "url"];
const TITLE_HEADERS: &[&str] = &["title 1", "title"];
const META_HEADERS: &[&str] = &["meta description 1", "meta description", "meta"];
const H1_HEADERS: &[&str] = &["h1-1", "h1"];
const TEXT_HEADERS: &[&str] = &["content", "text", "body"];

#[derive(Debug, PartialEq)]
pub enum ParseError {
    EmptyFile,
    MissingUrlColumn,
    MissingTextColumn,
}

fn find_col(headers: &csv::StringRecord, candidates: &[&str]) -> Option<usize> {
    headers
        .iter()
        .position(|h| candidates.contains(&h.trim().to_lowercase().as_str()))
}

fn field(rec: &csv::StringRecord, idx: Option<usize>) -> String {
    idx.and_then(|i| rec.get(i)).unwrap_or("").trim().to_string()
}

/// Parse raw CSV bytes (e.g. a Screaming Frog export) into a deduplicated Corpus.
pub fn parse_corpus(csv_bytes: &[u8]) -> Result<Corpus, ParseError> {
    if csv_bytes.iter().all(|b| b.is_ascii_whitespace()) {
        return Err(ParseError::EmptyFile);
    }

    let mut rdr = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(csv_bytes);

    let headers = match rdr.headers() {
        Ok(h) => h.clone(),
        Err(_) => return Err(ParseError::EmptyFile),
    };

    let url_idx = find_col(&headers, URL_HEADERS).ok_or(ParseError::MissingUrlColumn)?;
    let text_idx = find_col(&headers, TEXT_HEADERS).ok_or(ParseError::MissingTextColumn)?;
    let title_idx = find_col(&headers, TITLE_HEADERS);
    let meta_idx = find_col(&headers, META_HEADERS);
    let h1_idx = find_col(&headers, H1_HEADERS);

    let mut pages: Vec<Page> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut total = 0usize;
    let mut skipped = 0usize;

    for result in rdr.records() {
        total += 1;
        let rec = match result {
            Ok(r) => r,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };

        let url = rec.get(url_idx).unwrap_or("").trim().to_string();
        if url.is_empty() || !seen.insert(url.clone()) {
            skipped += 1;
            continue;
        }

        let text = rec.get(text_idx).unwrap_or("").trim().to_string();
        let word_count = text.split_whitespace().count();

        pages.push(Page {
            url,
            title: field(&rec, title_idx),
            meta: field(&rec, meta_idx),
            h1: field(&rec, h1_idx),
            text,
            word_count,
        });
    }

    Ok(Corpus {
        pages,
        total_rows: total,
        skipped_rows: skipped,
    })
}
