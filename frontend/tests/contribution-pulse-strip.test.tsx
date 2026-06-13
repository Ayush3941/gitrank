import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContributionPulseStrip } from "@/components/shared/ContributionPulseStrip";
import type { Contribution } from "@/types/gitrank";

describe("ContributionPulseStrip", () => {
  it("renders a tile for each day in the requested window", () => {
    const contributions = [
      buildContribution({ mergedAt: "2026-05-25T10:00:00.000Z" }),
      buildContribution({ id: "c2", number: 2, mergedAt: "2026-05-24T09:00:00.000Z" }),
    ];

    withFrozenNow("2026-05-25T12:00:00.000Z", () => {
      render(<ContributionPulseStrip contributions={contributions} days={7} label="Pulse" />);
    });

    expect(screen.queryByText("Pulse")).not.toBeNull();
    expect(screen.queryByText("2 of 7 active days")).not.toBeNull();
    expect(screen.queryByText("Today")).not.toBeNull();
    expect(screen.queryByText("Peak")).not.toBeNull();
    expect(screen.queryByText("May 25, 1 contribution")).not.toBeNull();
    const list = screen.getByRole("list");
    const tiles = within(list).getAllByRole("listitem");
    expect(tiles).toHaveLength(7);
  });

  it("counts multiple contributions on the same day without inflating active-day count", () => {
    const contributions = [
      buildContribution({ id: "same-day-1", number: 11, mergedAt: "2026-05-25T14:00:00.000Z" }),
      buildContribution({ id: "same-day-2", number: 12, mergedAt: "2026-05-25T19:30:00.000Z" }),
      buildContribution({ id: "other-day", number: 13, mergedAt: "2026-05-23T19:30:00.000Z" }),
    ];

    withFrozenNow("2026-05-25T23:59:59.000Z", () => {
      render(<ContributionPulseStrip contributions={contributions} days={7} />);
    });

    expect(screen.queryByText("2 of 7 active days")).not.toBeNull();
    expect(screen.queryByText("May 25, 2 contributions")).not.toBeNull();
    expect(screen.queryByText(/May 25: 2 contributions/i)).not.toBeNull();
    expect(screen.queryByTitle(/May 25: 2 contributions/i)).toBeNull();
  });

  it("uses singular active-day copy for one active day in the window", () => {
    const contributions = [
      buildContribution({ mergedAt: "2026-05-25T10:00:00.000Z" }),
      buildContribution({ id: "same-day", number: 2, mergedAt: "2026-05-25T20:00:00.000Z" }),
    ];

    withFrozenNow("2026-05-25T23:59:59.000Z", () => {
      render(<ContributionPulseStrip contributions={contributions} days={1} />);
    });

    expect(screen.queryByText("1 of 1 active day")).not.toBeNull();
  });

  it("uses explicit unavailable copy when the pulse window is invalid", () => {
    withFrozenNow("2026-05-25T23:59:59.000Z", () => {
      render(<ContributionPulseStrip contributions={[]} days={0} />);
    });

    expect(screen.queryByText("Pulse window unavailable")).not.toBeNull();
    expect(screen.queryByText("Today unavailable")).not.toBeNull();
    expect(screen.queryByText("Window unavailable")).not.toBeNull();
    expect(screen.queryByText("No data")).toBeNull();
  });
});

function withFrozenNow(isoTimestamp: string, run: () => void) {
  const mocked = vi.useFakeTimers();
  vi.setSystemTime(new Date(isoTimestamp));
  try {
    run();
  } finally {
    mocked.useRealTimers();
  }
}

function buildContribution(overrides: Partial<Contribution>): Contribution {
  return {
    id: overrides.id ?? "c1",
    scoreEventId: overrides.scoreEventId ?? "se1",
    scoreVersion: overrides.scoreVersion ?? "v1alpha1",
    formulaVersion: overrides.formulaVersion ?? "v1alpha1",
    pullRequestId: overrides.pullRequestId ?? "pr1",
    analysisId: overrides.analysisId ?? "analysis1",
    owner: overrides.owner ?? "octo",
    repo: overrides.repo ?? "gitrank",
    number: overrides.number ?? 1,
    title: overrides.title ?? "Test contribution",
    status: overrides.status ?? "merged",
    category: overrides.category ?? "Backend",
    difficultyScore: overrides.difficultyScore ?? 1,
    impactScore: overrides.impactScore ?? 1,
    reviewDepthScore: overrides.reviewDepthScore ?? 1,
    testSignalScore: overrides.testSignalScore ?? 1,
    repoWeight: overrides.repoWeight ?? 1,
    antiSpamMultiplier: overrides.antiSpamMultiplier ?? 1,
    xpEarned: overrides.xpEarned ?? 100,
    additions: overrides.additions ?? 10,
    deletions: overrides.deletions ?? 2,
    changedFilesCount: overrides.changedFilesCount ?? 1,
    mergedAt: overrides.mergedAt ?? "2026-05-25T00:00:00.000Z",
    maintainerReviewed: overrides.maintainerReviewed ?? true,
    linkedIssue: overrides.linkedIssue ?? false,
    ciPassed: overrides.ciPassed ?? true,
    aiSummary: overrides.aiSummary ?? "deterministic summary",
    evidenceSignals: overrides.evidenceSignals ?? [],
    evidenceState: overrides.evidenceState,
    evidenceMissing: overrides.evidenceMissing,
    reportEvidenceStatus: overrides.reportEvidenceStatus,
    reportAnalysisSource: overrides.reportAnalysisSource,
    reportStale: overrides.reportStale,
  };
}
