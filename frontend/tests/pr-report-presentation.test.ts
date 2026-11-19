import { describe, expect, it } from "vitest";
import { buildPRReportPresentation } from "@/features/pr-report/lib/pr-report-presentation";
import { toPullRequestAnalysis } from "@/lib/api/pr-report-api";
import { prReportFixture } from "@/tests/helpers/live-fixtures";

describe("PR report presentation", () => {
  it("anchors a scored report without requiring AI text", () => {
    const result = buildPRReportPresentation(toPullRequestAnalysis(prReportFixture));
    expect(result.evidenceAnchored).toBe(true);
    expect(result.signalTier).toBe("High signal");
    expect(result).not.toHaveProperty("reportStateGuidance");
  });
  it("deduplicates repeated badge rewards while preserving merged evidence chips", () => {
    const report = toPullRequestAnalysis({
      ...prReportFixture,
      badge_unlocks: [
        {
          key: "test-builder-a",
          name: "Test Builder",
          awarded_at: "2026-05-10T12:00:00Z",
          evidence_signals: ["testing_xp=120", "rule=test_builder"],
        },
        {
          key: "test-builder-b",
          name: "test builder",
          awarded_at: "2026-05-10T12:00:00Z",
          rule_version: "quest-rewards/v1",
          evidence_signals: ["rule=test_builder", "rule=quest_reward"],
        },
      ],
    });

    const presentation = buildPRReportPresentation(report);

    expect(presentation.uniqueBadgeUnlocks).toHaveLength(1);
    expect(presentation.uniqueBadgeUnlocks[0]).toMatchObject({
      key: "test-builder-a",
      name: "Test Builder",
      ruleVersion: "quest-rewards/v1",
      evidenceSignals: ["testing_xp=120", "rule=test_builder", "rule=quest_reward"],
    });
  });

});
