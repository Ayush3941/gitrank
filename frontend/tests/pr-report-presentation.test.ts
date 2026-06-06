import { describe, expect, it } from "vitest";
import {
  buildPRReportPresentation,
  buildRetryAiSummaryNotice,
} from "@/features/pr-report/lib/pr-report-presentation";
import { toPullRequestAnalysis } from "@/lib/api/pr-report-api";
import { prReportFixture } from "@/tests/helpers/live-fixtures";

describe("pr report presentation model", () => {
  it("surfaces rate-limited AI fallback guidance without weakening deterministic evidence", () => {
    const report = toPullRequestAnalysis({
      ...prReportFixture,
      contribution: {
        ...prReportFixture.contribution,
        evidence_signals: ["fallback_reason=ai_rate_limited"],
      },
      evidence_state: {
        status: "rate_limited",
        reasons: ["analysis has not been persisted"],
        missing_evidence: ["analysis"],
        analysis_source: "deterministic fallback",
        analysis_confidence: 0.63,
        deterministic_only: false,
        ai_fallback: false,
        rate_limited: true,
        stale: false,
      },
    });

    const presentation = buildPRReportPresentation(report);

    expect(presentation.fallbackDetail).toBe("rate limited");
    expect(presentation.summarySectionLabel).toBe("Impact summary (deterministic fallback)");
    expect(presentation.reportStateGuidance?.label).toBe("Rate limited");
    expect(presentation.canRetryAiSummary).toBe(true);
    expect(presentation.evidenceAnchored).toBe(false);
    expect(presentation.hasPersistedScoreEvidence).toBe(true);
    expect(presentation.signalTier).toBe("High signal");
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

  it("maps retry execution outcomes into user-facing notices", () => {
    expect(
      buildRetryAiSummaryNotice({
        status: "partial",
        mode: "pull_request",
        started_at: "2026-05-10T12:00:00Z",
        finished_at: "2026-05-10T12:00:03Z",
        fetched: {},
        persisted: {},
      }),
    ).toMatchObject({
      tone: "warning",
      message:
        "Retry executed with partial upstream data. Deterministic score stays active while AI enrichment retries.",
    });

    expect(
      buildRetryAiSummaryNotice({
        status: "queued",
        mode: "pull_request",
        started_at: "2026-05-10T12:00:00Z",
        finished_at: "2026-05-10T12:00:03Z",
        fetched: {},
        persisted: {},
      }),
    ).toMatchObject({
      tone: "success",
      message:
        "Retry queued. Keep this report open for a moment while enrichment catches up.",
    });
  });
});
