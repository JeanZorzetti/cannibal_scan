import { describe, it, expect } from "vitest";
import { toCannibalCsv } from "./csv";
import type { CrawledPage } from "./csv";

const simple: CrawledPage = {
  url: "https://example.com/page",
  title: "Example Page",
  h1: "Hello World",
  meta: "A simple page",
  content: "Some body text here",
};

describe("toCannibalCsv", () => {
  it("emits the exact cannibal_scan header", () => {
    const csv = toCannibalCsv([simple]);
    expect(csv.split("\n")[0]).toBe("Address,Title 1,H1-1,Meta Description 1,Content");
  });

  it("emits one data row per page", () => {
    const csv = toCannibalCsv([simple, simple]);
    expect(csv.split("\n").length).toBe(3); // header + 2 rows
  });

  it("quotes fields containing commas", () => {
    const page: CrawledPage = { ...simple, title: "Shoes, Bags, and More" };
    const csv = toCannibalCsv([page]);
    expect(csv).toContain('"Shoes, Bags, and More"');
  });

  it("quotes fields containing double quotes (and doubles them)", () => {
    const page: CrawledPage = { ...simple, h1: 'Say "Hello"' };
    const csv = toCannibalCsv([page]);
    expect(csv).toContain('"Say ""Hello"""');
  });

  it("quotes fields containing newlines in content", () => {
    const page: CrawledPage = { ...simple, content: "line one\nline two" };
    const csv = toCannibalCsv([page]);
    expect(csv).toContain('"line one\nline two"');
  });

  it("produces exactly 5 fields per row for simple values", () => {
    const csv = toCannibalCsv([simple]);
    const dataRow = csv.split("\n")[1];
    expect(dataRow.split(",").length).toBe(5);
  });

  it("handles empty content gracefully", () => {
    const page: CrawledPage = { ...simple, content: "" };
    const csv = toCannibalCsv([page]);
    const dataRow = csv.split("\n")[1];
    expect(dataRow).toBeTruthy();
    expect(dataRow.endsWith(",")).toBe(true); // last field empty
  });

  it("returns only the header for zero rows", () => {
    const csv = toCannibalCsv([]);
    expect(csv).toBe("Address,Title 1,H1-1,Meta Description 1,Content");
  });
});
