use cannibalscan_wasm_core::parser::{parse_corpus, ParseError};

#[test]
fn parses_minimal_screaming_frog_csv() {
    let csv = "Address,Title 1,Content\n\
               https://a.com,Page A,hello world foo\n\
               https://b.com,Page B,bar baz\n";
    let corpus = parse_corpus(csv.as_bytes()).unwrap();
    assert_eq!(corpus.pages.len(), 2);
    assert_eq!(corpus.pages[0].url, "https://a.com");
    assert_eq!(corpus.pages[0].title, "Page A");
    assert_eq!(corpus.pages[0].text, "hello world foo");
    assert_eq!(corpus.pages[0].word_count, 3);
    assert_eq!(corpus.total_rows, 2);
}

#[test]
fn detects_alternate_headers_any_order() {
    let csv = "url,body,meta description,h1,title\n\
               https://x.com,one two,desc here,Heading,Title X\n";
    let corpus = parse_corpus(csv.as_bytes()).unwrap();
    let p = &corpus.pages[0];
    assert_eq!(p.url, "https://x.com");
    assert_eq!(p.text, "one two");
    assert_eq!(p.meta, "desc here");
    assert_eq!(p.h1, "Heading");
    assert_eq!(p.title, "Title X");
}

#[test]
fn empty_file_errors() {
    assert_eq!(parse_corpus(b""), Err(ParseError::EmptyFile));
}

#[test]
fn missing_url_column_errors() {
    let csv = "Title 1,Content\nPage,hello\n";
    assert_eq!(parse_corpus(csv.as_bytes()), Err(ParseError::MissingUrlColumn));
}

#[test]
fn missing_text_column_errors() {
    let csv = "Address,Title 1\nhttps://a.com,Page A\n";
    assert_eq!(parse_corpus(csv.as_bytes()), Err(ParseError::MissingTextColumn));
}

#[test]
fn dedups_urls_and_counts_skipped() {
    let csv = "Address,Content\n\
               https://a.com,one\n\
               https://a.com,dup\n\
               ,blank url row\n\
               https://b.com,two\n";
    let corpus = parse_corpus(csv.as_bytes()).unwrap();
    assert_eq!(corpus.pages.len(), 2);
    assert_eq!(corpus.total_rows, 4);
    assert_eq!(corpus.skipped_rows, 2);
}
