import { describe, expect, it } from "vitest";
import {
  buildPRReportPresentation,
  buildRetryAiSummaryNotice,
} from "@/features/pr-report/lib/pr-report-presentation";
import { toPullRequestAnalysis } from "@/lib/api/pr-report-api";
import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
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
    expect(presentation.reportStateGuidance?.cta).toBe("Open leaderboard");
    expect(presentation.reportStateGuidance?.href).toBe("/dashboard/leaderboard");
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

  const execution: ApiSyncExecutionResponse = {
    status: "completed",
    mode: "pull_request",
    started_at: "2026-05-10T12:00:00Z",
    finished_at: "2026-05-10T12:00:03Z",
    fetched: {},
    persisted: {},
  };

  it.each(["completed", "partial", "failed"])("does not claim AI success for %s extraction without persisted analysis", (status) => {
    expect(buildRetryAiSummaryNotice({ ...execution, status })).toEqual({
      tone: "warning",
      message: "AI analysis did not complete. This report keeps its existing evidence.",
    });
  });

  it("requires a saved AI artifact before reporting AI success", () => {
    const analysis = {
      analysis_id: "analysis-42",
      pull_request_id: "pr-42",
      analysis_source: "hybrid",
    };
    expect(buildRetryAiSummaryNotice({ ...execution, analysis })).toEqual({
      tone: "success",
      message: "AI summary saved. Report evidence refreshed.",
    });
    expect(buildRetryAiSummaryNotice({ ...execution, status: "partial", analysis })).toEqual({
      tone: "warning",
      message: "AI summary saved, but sync or score refresh was incomplete.",
    });
    expect(buildRetryAiSummaryNotice({ ...execution, analysis: { ...analysis, analysis_id: "" } }).tone).toBe("warning");
  });

  it.each([
    ["ai_not_enabled", "AI is not configured on the analyzer. Deterministic analysis was saved."],
    ["ai_auth_failed", "AI summary unavailable (auth failed). Deterministic analysis was saved."],
    ["ai_rate_limited", "AI summary unavailable (rate limited). Deterministic analysis was saved."],
    ["ai_quota_exceeded", "AI summary unavailable (quota exceeded). Deterministic analysis was saved."],
  ])("reports a saved deterministic fallback for %s", (fallback_reason, message) => {
    expect(buildRetryAiSummaryNotice({
      ...execution,
      analysis: {
        analysis_id: "analysis-42",
        pull_request_id: "pr-42",
        analysis_source: "deterministic",
        fallback_reason,
      },
    })).toEqual({ tone: "warning", message });
  });

  it("does not promise AI work for queued sync admission", () => {
    expect(buildRetryAiSummaryNotice({ ...execution, status: "queued" })).toEqual({
      tone: "warning",
      message: "Sync was queued. No AI summary has been generated yet.",
    });
  });
});
