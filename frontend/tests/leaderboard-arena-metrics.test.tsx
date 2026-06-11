import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaderboardArena } from "@/features/leaderboard/components/LeaderboardArena";
import type { LeaderboardSnapshot } from "@/types/gitrank";

describe("LeaderboardArena", () => {
  it("formats row XP metrics with shared XP labels", () => {
    render(<LeaderboardArena snapshot={buildSnapshot()} showDetails />);

    expect(screen.getByText("320 XP")).toBeTruthy();
    expect(screen.getByText("2,468 XP")).toBeTruthy();
  });
});

function buildSnapshot(): LeaderboardSnapshot {
  return {
    season: {
      id: "weekly-2026-W20",
      name: "Weekly arena",
      windowLabel: "May 10 - May 16",
      startsAt: "2026-05-10T00:00:00.000Z",
      endsAt: "2026-05-16T23:59:59.999Z",
      status: "Active",
      scoringVersion: "v2-smoke",
      promotionRule: "Top contributors move toward the next rank tier.",
      resetRule: "Weekly XP resets after the window.",
      promotionCutoffRank: 25,
      safetyCutoffRank: 75,
      explanation: "Leaderboard rows are backed by persisted season snapshots.",
    },
    rows: [
      {
        rank: 1,
        username: "live-maintainer",
        displayName: "Live Leaderboard Maintainer",
        title: "Systems Builder",
        rankTier: "Gold III",
        weeklyXp: 320,
        totalXp: 2468,
        movement: 3,
        focus: "Backend",
        division: "Backend",
        seasonXp: 320,
        xpToNextRank: 0,
        promotionZone: true,
        demotionRisk: false,
        evidenceSummary: "Persisted leaderboard evidence.",
        scoreFormulaVersion: "v2-smoke",
      },
    ],
  };
}
