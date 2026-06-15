import { describe, it, expect } from "vitest";
import { runAudit, type AuditModel } from "./run-audit";
import type { AuditPage } from "./prompt";

const report = {
  pairs: [
    { a: "https://s/a", b: "https://s/b", score: 0.9 },
    { a: "https://s/c", b: "https://s/d", score: 0.8 },
  ],
  compared: 6,
};

const pages: AuditPage[] = [
  { url: "https://s/a", title: "Best Running Shoes", h1: "Best Running Shoes", meta: "m" },
  { url: "https://s/b", title: "Running Shoes Guide", h1: "Best Running Shoes", meta: "m" },
  { url: "https://s/c", title: "Trail Shoes", h1: "Trail Shoes", meta: "m" },
  { url: "https://s/d", title: "Trail Running", h1: "Trail Shoes", meta: "m" },
];

const goodItems = [
  {
    cluster: ["https://s/a", "https://s/b"],
    keep: "https://s/a",
    merge_or_redirect: ["https://s/b"],
    consolidated_title: "Best Running Shoes",
    consolidated_meta: "The guide.",
    priority: 1,
    rationale: "Near-duplicate.",
  },
  {
    cluster: ["https://s/c", "https://s/d"],
    keep: "https://s/c",
    merge_or_redirect: ["https://s/d"],
    consolidated_title: "Trail Running Shoes",
    consolidated_meta: "Trails.",
    priority: 2,
    rationale: "Overlapping.",
  },
];

describe("runAudit", () => {
  it("clusters pairs, prompts the model, and validates the report", async () => {
    let seenPrompt = "";
    const model: AuditModel = {
      async generateReport(prompt) {
        seenPrompt = prompt;
        return { items: goodItems };
      },
    };
    const result = await runAudit(report, pages, { model });
    expect(seenPrompt).toContain("https://s/a");
    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item.cluster).toContain(item.keep);
    }
  });

  it("returns empty items without calling the model when there are no pairs", async () => {
    let called = false;
    const model: AuditModel = {
      async generateReport() {
        called = true;
        return { items: [] };
      },
    };
    const result = await runAudit({ pairs: [] }, [], { model });
    expect(result.items).toEqual([]);
    expect(called).toBe(false);
  });

  it("throws when the model returns an invalid report", async () => {
    const model: AuditModel = {
      async generateReport() {
        return {
          items: [{ ...goodItems[0], keep: "https://s/not-in-cluster" }],
        };
      },
    };
    await expect(runAudit(report, pages, { model })).rejects.toThrow();
  });
});
