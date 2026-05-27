import { describe, expect, it } from "vitest";
import { hasUserContributionEvidence } from "@/lib/presentation/sync-evidence";
import type { UserProfile } from "@/types/gitrank";

function buildUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    username: "octocat",
    displayName: "Octo Cat",
    title: "Explorer",
    avatarUrl: "https://example.test/avatar.png",
    bio: "Test user",
    gitRankScore: 0,
    mergedPrCount: 0,
    reviewedPrCount: 0,
    bestCategory: "Backend",
    consistencyScore: 0,
    strongestSignals: [],
    topSkills: [],
    level: {
      currentLevel: 1,
      title: "Explorer",
      currentXp: 400,
      nextLevelXp: 700,
      rankTier: "Bronze I",
    },
    rankProgress: {
      season: {
        id: "season-1",
        name: "Season 1",
        windowLabel: "May",
        startsAt: "2026-05-01T00:00:00Z",
        endsAt: "2026-05-31T23:59:59Z",
        status: "Active",
        scoringVersion: "v1alpha1",
        promotionRule: "Top 25 move toward next tier.",
        resetRule: "Weekly XP resets.",
        promotionCutoffRank: 25,
        safetyCutoffRank: 75,
        explanation: "Season test",
      },
      currentTier: "Bronze I",
      nextTier: "Silver II",
      seasonXp: 0,
      xpToNextTier: 300,
      promotionCutoffRank: 25,
      safetyCutoffRank: 75,
      evidenceSignals: [],
    },
    skillTree: [],
    scoreBreakdown: [],
    badges: [],
    quests: [],
    contributions: [],
    repositories: [],
    privacy: {
      publicProfileEnabled: true,
      showExactPRs: true,
      showAiSummaries: true,
      showLeaderboardParticipation: true,
      reducedGamification: false,
    },
    syncStatus: {
      state: "synced",
      lastSyncedAt: "2026-05-27T00:00:00Z",
      currentStep: "Profile snapshot is current",
      progress: 100,
      partialProfileAvailable: false,
    },
    ...overrides,
  };
}

describe("hasUserContributionEvidence", () => {
  it("returns false for XP-only profiles without PR evidence", () => {
    const user = buildUser({
      mergedPrCount: 0,
      contributions: [],
    });
    expect(hasUserContributionEvidence(user)).toBe(false);
  });

  it("returns true when merged PR count is non-zero", () => {
    const user = buildUser({
      mergedPrCount: 2,
      contributions: [],
    });
    expect(hasUserContributionEvidence(user)).toBe(true);
  });

  it("returns true when a concrete PR contribution exists", () => {
    const user = buildUser({
      mergedPrCount: 0,
      contributions: [
        {
          id: "score-1",
          owner: "octo",
          repo: "gitrank",
          number: 17,
          title: "Improve tests",
          status: "merged",
          category: "Testing",
          difficultyScore: 1,
          impactScore: 1,
          reviewDepthScore: 1,
          testSignalScore: 1,
          repoWeight: 1,
          antiSpamMultiplier: 1,
          xpEarned: 90,
          additions: 12,
          deletions: 3,
          changedFilesCount: 1,
          mergedAt: "2026-05-20T00:00:00Z",
          maintainerReviewed: true,
          linkedIssue: false,
          ciPassed: true,
          aiSummary: "Merged test improvement",
          evidenceSignals: [],
        },
      ],
    });
    expect(hasUserContributionEvidence(user)).toBe(true);
  });
});
