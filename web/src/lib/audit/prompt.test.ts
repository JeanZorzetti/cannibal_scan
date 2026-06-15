import { describe, it, expect } from "vitest";
import { buildAuditPrompt } from "./prompt";

const pages = [
  { url: "https://s/a", title: "Best Running Shoes", h1: "Best Running Shoes", meta: "Find them" },
  { url: "https://s/b", title: "Running Shoes Guide", h1: "Best Running Shoes", meta: "A guide" },
  { url: "https://s/c", title: "Trail Shoes", h1: "Trail Shoes", meta: "Trails" },
  { url: "https://s/d", title: "Trail Running", h1: "Trail Shoes", meta: "Trail run" },
];

const twoClusters = [
  ["https://s/a", "https://s/b"],
  ["https://s/c", "https://s/d"],
];

describe("buildAuditPrompt", () => {
  it("includes every clustered url and its title", () => {
    const prompt = buildAuditPrompt(twoClusters, pages);
    for (const p of pages) {
      expect(prompt).toContain(p.url);
      expect(prompt).toContain(p.title);
    }
  });

  it("separates distinct clusters", () => {
    const prompt = buildAuditPrompt(twoClusters, pages);
    expect(prompt).toMatch(/cluster\s*1/i);
    expect(prompt).toMatch(/cluster\s*2/i);
  });

  it("instructs structured JSON output with the key fields", () => {
    const prompt = buildAuditPrompt([["https://s/a", "https://s/b"]], pages);
    expect(prompt.toLowerCase()).toContain("json");
    expect(prompt).toContain("keep");
    expect(prompt).toContain("consolidated_title");
  });
});
