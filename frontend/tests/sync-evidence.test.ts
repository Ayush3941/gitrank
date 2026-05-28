import { describe, expect, it } from "vitest";
import {
  deriveEffectiveSyncState,
  hasUserContributionEvidence,
  hasUserMaterializedSyncEvidence,
  hasUserRepositoryEvidence,
  selectProfileSyncRunStatuses,
  shouldShowSyncRefreshPill,
} from "@/lib/presentation/sync-evidence";
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
    });
    expect(hasUserContributionEvidence(user)).toBe(true);
  });

  it("returns false for placeholder rows without persisted evidence identity", () => {
    const user = buildUser({
      mergedPrCount: 0,
      contributions: [
        {
          id: "placeholder-1",
          owner: "octo",
          repo: "gitrank",
          number: 24,
          title: "placeholder contribution",
          status: "merged",
          category: "Testing",
          difficultyScore: 0,
          impactScore: 0,
          reviewDepthScore: 0,
          testSignalScore: 0,
          repoWeight: 1,
          antiSpamMultiplier: 1,
          xpEarned: 0,
          additions: 0,
          deletions: 0,
          changedFilesCount: 0,
          mergedAt: "",
          maintainerReviewed: false,
          linkedIssue: false,
          ciPassed: false,
          aiSummary: "",
          evidenceSignals: [],
        },
      ],
    });
    expect(hasUserContributionEvidence(user)).toBe(false);
  });
});

describe("deriveEffectiveSyncState", () => {
  it("returns partially_synced when backend says synced but evidence is absent", () => {
    const user = buildUser({
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: true,
      },
      mergedPrCount: 0,
      contributions: [],
    });
    expect(deriveEffectiveSyncState(user)).toBe("partially_synced");
  });

  it("returns partially_synced when only repository rows exist without PR contribution evidence", () => {
    const user = buildUser({
      mergedPrCount: 0,
      contributions: [],
      repositories: [
        {
          name: "octo/repo",
          tracked: true,
          visibility: "Public",
          reason: "tracked",
        },
      ],
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user)).toBe("partially_synced");
  });

  it("keeps synced when concrete PR evidence exists", () => {
    const user = buildUser({
      mergedPrCount: 1,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user)).toBe("synced");
  });

  it("returns syncing when a running sync run is present", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["running"])).toBe("syncing");
  });

  it("returns syncing when a queued sync run is present", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["queued"])).toBe("syncing");
  });

  it("ignores stale running rows once a newer terminal run exists", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["completed", "running"])).toBe("synced");
  });

  it("keeps syncing when the newest run is still active even if older runs completed", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["running", "completed"])).toBe("syncing");
  });

  it("keeps the latest terminal partial state when older rows remain active", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["partial", "running"])).toBe("partially_synced");
  });

  it("returns partially_synced when latest terminal sync run is partial", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["partial"])).toBe("partially_synced");
  });

  it("returns failed when latest terminal sync run is failed", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["failed"])).toBe("failed");
  });

  it("keeps failed when stale running rows exist after the newest failed terminal run", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(deriveEffectiveSyncState(user, ["failed", "running"])).toBe("failed");
  });
});

describe("repository/materialized sync evidence helpers", () => {
  it("returns false for empty repository evidence", () => {
    const user = buildUser({
      repositories: [],
    });
    expect(hasUserRepositoryEvidence(user)).toBe(false);
    expect(hasUserMaterializedSyncEvidence(user)).toBe(false);
  });

  it("returns true for tracked owner/repo entries", () => {
    const user = buildUser({
      repositories: [
        {
          name: "octo/repo",
          tracked: true,
          visibility: "Public",
          reason: "tracked",
        },
      ],
    });
    expect(hasUserRepositoryEvidence(user)).toBe(true);
    expect(hasUserMaterializedSyncEvidence(user)).toBe(false);
  });
});

describe("shouldShowSyncRefreshPill", () => {
  it("returns false without contribution evidence", () => {
    const user = buildUser({
      mergedPrCount: 0,
      contributions: [],
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: true,
      },
    });
    expect(shouldShowSyncRefreshPill(user)).toBe(false);
  });

  it("returns true for synced users with contribution evidence", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(shouldShowSyncRefreshPill(user)).toBe(true);
  });

  it("returns false for repository-only rows without contribution evidence", () => {
    const user = buildUser({
      mergedPrCount: 0,
      contributions: [],
      repositories: [
        {
          name: "octo/repo",
          tracked: true,
          visibility: "Public",
          reason: "tracked",
        },
      ],
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(shouldShowSyncRefreshPill(user)).toBe(false);
  });

  it("returns false when sync runs are still active", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(shouldShowSyncRefreshPill(user, ["running"])).toBe(false);
  });

  it("returns false when latest terminal sync status is partial", () => {
    const user = buildUser({
      mergedPrCount: 2,
      syncStatus: {
        state: "synced",
        lastSyncedAt: "2026-05-27T00:00:00Z",
        currentStep: "Profile snapshot is current",
        progress: 100,
        partialProfileAvailable: false,
      },
    });
    expect(shouldShowSyncRefreshPill(user, ["partial"])).toBe(false);
  });
});

describe("selectProfileSyncRunStatuses", () => {
  it("keeps user-scoped runs for the active profile including child run types", () => {
    const user = buildUser({ username: "Ayush3941" });
    const statuses = selectProfileSyncRunStatuses(
      [
        { status: "running", run_type: "user", requested_user: "Ayush3941", requested_by_github_login: "Ayush3941" },
        { status: "partial", run_type: "pull_request", requested_user: "Ayush3941" },
        { status: "failed", run_type: "review", requested_user: "octocat", requested_by_github_login: "octocat" },
        { status: "completed", run_type: "user" },
      ],
      user,
    );
    expect(statuses).toStrictEqual(["running", "partial", "completed"]);
  });

  it("ignores runs without status or without profile ownership signal", () => {
    const user = buildUser({ username: "octocat" });
    const statuses = selectProfileSyncRunStatuses(
      [
        { status: "", run_type: "user", requested_user: "octocat" },
        { status: "queued", run_type: "repository", requested_by_github_login: "someone-else" },
        { status: "partial", run_type: "user", requested_user: "octocat" },
        { status: "running", run_type: "repository", requested_by_github_login: "octocat" },
      ],
      user,
    );
    expect(statuses).toStrictEqual(["partial", "running"]);
  });

  it("matches user sync runs when requested_user includes @ prefix", () => {
    const user = buildUser({ username: "Ayush3941" });
    const statuses = selectProfileSyncRunStatuses(
      [
        { status: "running", run_type: "user", requested_user: "@Ayush3941" },
        { status: "completed", run_type: "user", requested_user: "@someone-else" },
      ],
      user,
    );
    expect(statuses).toStrictEqual(["running"]);
  });

  it("matches user sync runs when subject handle is available", () => {
    const user = buildUser({ username: "Ayush3941" });
    const statuses = selectProfileSyncRunStatuses(
      [
        { status: "running", run_type: "user", subject: "@Ayush3941" },
        { status: "failed", run_type: "user", subject: "@octocat" },
      ],
      user,
    );
    expect(statuses).toStrictEqual(["running"]);
  });
});
