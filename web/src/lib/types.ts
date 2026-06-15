export interface Page {
  url: string;
  title: string;
  meta: string;
  h1: string;
  text: string;
  word_count: number;
}

export interface Corpus {
  pages: Page[];
  total_rows: number;
  skipped_rows: number;
}
