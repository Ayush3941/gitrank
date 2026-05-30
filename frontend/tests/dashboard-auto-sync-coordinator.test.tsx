import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardAutoSyncCoordinator } from "@/components/shared/DashboardAutoSyncCoordinator";
import { frontendPolicy } from "@/lib/runtime/frontend-policy";
import type { UserProfile } from "@/types/gitrank";

const useMyProfileMock = vi.fn();
const useProfileSyncRunsMock = vi.fn();
const requestProfileSyncMock = vi.fn();

vi.mock("@/hooks/use-profile", () => ({
  useMyProfile: () => useMyProfileMock(),
}));

vi.mock("@/hooks/use-profile-sync-runs", () => ({
  useProfileSyncRuns: () => useProfileSyncRunsMock(),
}));

vi.mock("@/hooks/use-account-actions", () => ({
  useRequestProfileSync: () => ({
    mutate: requestProfileSyncMock,
    isPending: false,
  }),
}));

vi.mock("@/hooks/use-gamification-preference", () => ({
  useAccountGamificationPreference: vi.fn(),
}));

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));

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
      currentXp: 0,
      nextLevelXp: 300,
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
      lastSyncedAt: new Date().toISOString(),
      currentStep: "Profile snapshot is current",
      progress: 100,
      partialProfileAvailable: false,
    },
    ...overrides,
  };
}

function buildSyncRun(status: string) {
  return {
    id: "run-1",
    run_type: "user",
    status,
    subject: "@octocat",
    started_at: new Date().toISOString(),
  };
}

describe("DashboardAutoSyncCoordinator", () => {
  beforeEach(() => {
    useMyProfileMock.mockReset();
    useProfileSyncRunsMock.mockReset();
    requestProfileSyncMock.mockReset();
    window.sessionStorage.clear();
    document.cookie = `${frontendPolicy.csrfCookieName}=`;
  });

  it("queues auto-sync when backend status is synced but PR evidence is empty", async () => {
    useMyProfileMock.mockReturnValue({
      data: {
        refreshedAt: new Date().toISOString(),
        isStale: false,
        user: buildUser({
          mergedPrCount: 0,
          contributions: [],
          syncStatus: {
            state: "synced",
            lastSyncedAt: new Date().toISOString(),
            currentStep: "Profile snapshot is current",
            progress: 100,
            partialProfileAvailable: true,
          },
        }),
      },
      isLoading: false,
      isError: false,
    });
    useProfileSyncRunsMock.mockReturnValue({
      data: {
        runs: [buildSyncRun("completed")],
      },
    });

    render(<DashboardAutoSyncCoordinator />);

    await waitFor(() => {
      expect(requestProfileSyncMock).toHaveBeenCalledTimes(1);
    });
  });

  it("does not queue auto-sync when evidence is materialized and session bootstrap already ran", async () => {
    const nowISO = new Date().toISOString();
    document.cookie = `${frontendPolicy.csrfCookieName}=csrf-token-1`;
    window.sessionStorage.setItem(
      "gitrank:auto-sync:bootstrap:octocat:csrf-token-1",
      "1",
    );

    useMyProfileMock.mockReturnValue({
      data: {
        refreshedAt: nowISO,
        isStale: false,
        user: buildUser({
          mergedPrCount: 1,
          contributions: [
            {
              id: "score-1",
              scoreEventId: "score-event-1",
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
          syncStatus: {
            state: "synced",
            lastSyncedAt: nowISO,
            currentStep: "Profile snapshot is current",
            progress: 100,
            partialProfileAvailable: false,
          },
        }),
      },
      isLoading: false,
      isError: false,
    });
    useProfileSyncRunsMock.mockReturnValue({
      data: {
        runs: [buildSyncRun("completed")],
      },
    });

    render(<DashboardAutoSyncCoordinator />);

    await waitFor(() => {
      expect(requestProfileSyncMock).not.toHaveBeenCalled();
    });
  });
});
