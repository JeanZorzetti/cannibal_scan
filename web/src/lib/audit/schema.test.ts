import { describe, it, expect } from "vitest";
import { parseAuditReport } from "./schema";

const validItem = {
  cluster: ["https://x/a", "https://x/b"],
  keep: "https://x/a",
  merge_or_redirect: ["https://x/b"],
  consolidated_title: "Best Running Shoes",
  consolidated_meta: "The definitive guide to the best running shoes.",
  priority: 1,
  rationale: "Two near-duplicate pages competing for the same query.",
};

describe("parseAuditReport", () => {
  it("accepts a well-formed report", () => {
    const report = parseAuditReport({ items: [validItem] });
    expect(report.items).toHaveLength(1);
    expect(report.items[0].keep).toBe("https://x/a");
  });

  it("rejects a report with a missing required field", () => {
    const { rationale: _omit, ...incomplete } = validItem;
    expect(() => parseAuditReport({ items: [incomplete] })).toThrow();
  });

  it("rejects keep that is not one of the cluster URLs", () => {
    expect(() =>
      parseAuditReport({ items: [{ ...validItem, keep: "https://x/zzz" }] }),
    ).toThrow();
  });

  it("rejects merge_or_redirect entries outside the cluster", () => {
    expect(() =>
      parseAuditReport({
        items: [{ ...validItem, merge_or_redirect: ["https://x/zzz"] }],
      }),
    ).toThrow();
  });
});
