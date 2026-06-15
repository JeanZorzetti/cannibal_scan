import { describe, it, expect } from "vitest";
import { clusterPairs } from "./cluster";

describe("clusterPairs", () => {
  it("merges a chain of pairs into one cluster", () => {
    const clusters = clusterPairs([
      { a: "A", b: "B" },
      { a: "B", b: "C" },
    ]);
    expect(clusters).toEqual([["A", "B", "C"]]);
  });

  it("keeps disjoint pairs as separate clusters", () => {
    const clusters = clusterPairs([
      { a: "A", b: "B" },
      { a: "C", b: "D" },
    ]);
    expect(clusters).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
  });

  it("is insensitive to pair order", () => {
    const forward = clusterPairs([
      { a: "A", b: "B" },
      { a: "B", b: "C" },
    ]);
    const reversed = clusterPairs([
      { a: "B", b: "C" },
      { a: "A", b: "B" },
    ]);
    expect(reversed).toEqual(forward);
  });
});
