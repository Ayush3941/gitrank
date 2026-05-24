import { describe, expect, it } from "vitest";
import {
  buildDeterministicImpactSummary,
  shouldUseDeterministicImpactSummary,
} from "@/lib/presentation/deterministic-impact-summary";

describe("shouldUseDeterministicImpactSummary", () => {
  it("returns true for empty or placeholder summaries", () => {
    expect(shouldUseDeterministicImpactSummary("")).toBe(true);
    expect(
      shouldUseDeterministicImpactSummary(
        "analysis has not been persisted · report snapshot is stale",
      ),
    ).toBe(true);
  });

  it("returns false for meaningful narrative text", () => {
    expect(
      shouldUseDeterministicImpactSummary(
        "Adds resilient retry handling in the gateway service and improves error visibility.",
      ),
    ).toBe(false);
  });
});

describe("buildDeterministicImpactSummary", () => {
  it("builds concise deterministic summary with actionable next move", () => {
    const summary = buildDeterministicImpactSummary({
      category: "Backend",
      status: "merged",
      changedFilesCount: 3,
      xpEarned: 132,
      impactScore: 56,
      reviewDepthScore: 28,
      testSignalScore: 18,
      maintainerReviewed: false,
      linkedIssue: true,
      ciPassed: false,
    });

    expect(summary).toContain("Merged PR backend service work");
    expect(summary).toContain("meaningful impact");
    expect(summary).toContain("linked issue context");
    expect(summary).toContain("Add regression tests to raise confidence.");
  });
});
