import { describe, it, expect } from "vitest";
import { normalizeUrl, isSameSite, isCrawlable } from "./url";

describe("normalizeUrl", () => {
  it("lowercases host", () => {
    expect(normalizeUrl("https://EXAMPLE.com/page")).toBe("https://example.com/page");
  });

  it("removes fragment", () => {
    expect(normalizeUrl("https://example.com/page#section")).toBe("https://example.com/page");
  });

  it("strips trailing slash (non-root)", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
  });

  it("keeps root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("resolves relative URLs with base", () => {
    expect(normalizeUrl("/about", "https://example.com/")).toBe("https://example.com/about");
  });

  it("returns null for mailto", () => {
    expect(normalizeUrl("mailto:a@b.com")).toBeNull();
  });

  it("returns null for invalid URL", () => {
    expect(normalizeUrl("not a url")).toBeNull();
  });
});

describe("isSameSite", () => {
  it("same host → true", () => {
    expect(isSameSite("https://example.com", "https://example.com/page")).toBe(true);
  });

  it("different host → false", () => {
    expect(isSameSite("https://example.com", "https://other.com/page")).toBe(false);
  });

  it("subdomain is different → false", () => {
    expect(isSameSite("https://example.com", "https://sub.example.com/page")).toBe(false);
  });
});

describe("isCrawlable", () => {
  it("http URL → true", () => {
    expect(isCrawlable("https://example.com/page")).toBe(true);
  });

  it("image → false", () => {
    expect(isCrawlable("https://example.com/img.jpg")).toBe(false);
  });

  it("pdf → false", () => {
    expect(isCrawlable("https://example.com/file.pdf")).toBe(false);
  });

  it("mailto → false", () => {
    expect(isCrawlable("mailto:a@b.com")).toBe(false);
  });

  it("js file → false", () => {
    expect(isCrawlable("https://example.com/bundle.js")).toBe(false);
  });
});
