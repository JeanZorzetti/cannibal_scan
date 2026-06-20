import { describe, it, expect } from "vitest";
import { runCompareAudit } from "./run-compare-audit";
import type { ComparisonReport } from "@/lib/types";
import type { SiteMetrics } from "./metrics";
import type { AuditModel } from "@/lib/audit/run-audit";

const emptyReport: ComparisonReport = { overlaps: [], gaps: [], compared: 0 };
const metrics: SiteMetrics = { pages: 5, avgWords: 300, pctWithTitle: 100, pctWithMeta: 80, pctWithH1: 60 };

function mockModel(result: unknown): AuditModel {
  return { generateReport: async () => result };
}

describe("runCompareAudit", () => {
  it("returns parsed recommendations from model output", async () => {
    const model = mockModel({
      recommendations: [
        {
          title: "Expand review page",
          action: "Add more content to the reviews page",
          target_pages: ["https://a.com/reviews"],
          reference_pages: ["https://b.com/reviews"],
          rationale: "Site B ranks for this term.",
          priority: 1,
        },
      ],
    });
    const result = await runCompareAudit(emptyReport, metrics, metrics, [], [], { model });
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].priority).toBe(1);
  });

  it("returns empty recommendations when model returns empty list", async () => {
    const model = mockModel({ recommendations: [] });
    const result = await runCompareAudit(emptyReport, metrics, metrics, [], [], { model });
    expect(result.recommendations).toHaveLength(0);
  });

  it("throws when model returns invalid shape", async () => {
    const model = mockModel({ bad: "data" });
    await expect(runCompareAudit(emptyReport, metrics, metrics, [], [], { model })).rejects.toThrow();
  });
});
