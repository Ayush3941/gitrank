import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBadgesPageModel,
  resolveBadgePageSizes,
} from "@/features/badges/lib/badges-page-model";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import type {
  Badge,
  LeaderboardSeason,
  ProfileViewData,
  UserProfile,
} from "@/types/gitrank";

describe("buildBadgesPageModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds shelf state, page sizes, streak, and ABRA request inputs", () => {
    const badges = [
      buildBadge({ id: "ship", name: "Ship", unlocked: true, rarity: "Rare" }),
      buildBadge({ id: "guard", name: "Guard", unlocked: false, rarity: "Epic", progress: 80 }),
      buildBadge({ id: "docs", name: "Docs", unlocked: true, rarity: "Common" }),
    ];
    const profile = buildProfile({ badges });
    const model = buildBadgesPageModel({
      badges,
      profile,
      rarity: "Rare",
      visibility: "Unlocked",
      deferredRarity: "All",
      deferredVisibility: "All",
      visibleBadgeCount: 2,
      visibleLockedCount: 1,
      constrainedNetwork: false,
    });

    expect(model.pageSizes).toEqual(resolveBadgePageSizes(false));
    expect(model.isFiltering).toBe(true);
    expect(model.filterState).toEqual({
      canResetFilters: true,
      activeFilterCount: 2,
    });
    expect(model.badgeShelf.totalCount).toBe(3);
    expect(model.badgeShelf.unlockedCount).toBe(2);
    expect(model.badgeShelf.visibleBadges.map((badge) => badge.id)).toEqual(["ship", "guard"]);
    expect(model.badgeShelf.visibleLockedBadges.map((badge) => badge.id)).toEqual(["guard"]);
    expect(model.streak.currentStreakDays).toBeGreaterThan(0);
    expect(model.fallbackArchetype).toBe("Quality Champion");
    expect(model.abraPayload?.profile.badgeCount).toBe(2);
    expect(model.abraPayload?.badges.map((badge) => badge.id)).toEqual(["ship", "guard", "docs"]);
  });

  it("uses constrained page sizes and disables ABRA requests on constrained networks", () => {
    const badges = [
      buildBadge({ id: "ship", name: "Ship", unlocked: true }),
      buildBadge({ id: "guard", name: "Guard", unlocked: false }),
    ];
    const model = buildBadgesPageModel({
      badges,
      profile: buildProfile({ badges, strongestSignals: ["Security"] }),
      rarity: "All",
      visibility: "All",
      deferredRarity: "All",
      deferredVisibility: "All",
      visibleBadgeCount: 6,
      visibleLockedCount: 4,
      constrainedNetwork: true,
    });

    expect(model.pageSizes).toEqual(resolveBadgePageSizes(true));
    expect(model.isFiltering).toBe(false);
    expect(model.filterState.canResetFilters).toBe(false);
    expect(model.abraPayload).toBeNull();
    expect(model.fallbackArchetype).toBe("Guardian Engineer");
  });
});

function buildBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: overrides.id ?? "badge-1",
    name: overrides.name ?? "Evidence Badge",
    rarity: overrides.rarity ?? "Common",
    description: overrides.description ?? "Evidence-backed badge.",
    unlockCondition: overrides.unlockCondition ?? "Land a scored PR.",
    icon: overrides.icon ?? "bolt",
    unlocked: overrides.unlocked ?? true,
    earnedAt: overrides.earnedAt,
    progress: overrides.progress ?? (overrides.unlocked === false ? 0 : 100),
    evidencePrIds: overrides.evidencePrIds ?? [],
    rarityScore: overrides.rarityScore,
  };
}

function buildProfile({
  badges,
  strongestSignals = ["Testing"],
}: {
  badges: Badge[];
  strongestSignals?: UserProfile["strongestSignals"];
}): ProfileViewData {
  const season = buildSeason();
  const contribution = buildContribution({
    id: "contribution-1",
    mergedAt: "2026-06-08T09:00:00.000Z",
    status: "merged",
  });
  const user: UserProfile = {
    username: "octocat",
    displayName: "Octo Cat",
    title: "Systems Builder",
    avatarUrl: "https://example.com/avatar.png",
    bio: "Builds evidence-backed systems.",
    gitRankScore: 1200,
    mergedPrCount: 1,
    reviewedPrCount: 1,
    bestCategory: "Testing",
    consistencyScore: 80,
    strongestSignals,
    topSkills: strongestSignals,
    level: {
      currentLevel: 4,
      title: "Systems Builder",
      currentXp: 1200,
      nextLevelXp: 1500,
      rankTier: "Bronze I",
    },
    rankProgress: {
      season,
      currentTier: "Bronze I",
      nextTier: "Silver II",
      seasonXp: 120,
      xpToNextTier: 300,
      promotionCutoffRank: 25,
      safetyCutoffRank: 75,
      evidenceSignals: ["profile_snapshot"],
    },
    skillTree: [],
    contributions: [contribution],
    badges,
    quests: [],
    scoreChanges: [],
    xpTimeline: [],
    syncStatus: {
      state: "synced",
      progress: 100,
      partialProfileAvailable: false,
    },
    weeklyXp: 120,
    leaguePosition: 3,
    movement: 1,
    repositories: [],
    privacy: {
      publicProfileEnabled: true,
      showExactPRs: true,
      showAiSummaries: true,
      showLeaderboardParticipation: true,
      badgeUnlockedNotifications: true,
      levelUpNotifications: true,
      weeklyReportNotifications: true,
      reducedGamification: false,
    },
  };

  return {
    user,
    featuredContributions: [],
    topRepositories: [
      {
        name: "octo/gitrank",
        owner: "octo",
        repo: "gitrank",
        totalXp: 1200,
        contributionCount: 1,
        visibility: "Public",
        primarySkill: "Testing",
      },
    ],
    recentReports: [],
    shareHeadline: "Evidence-backed profile.",
    trendWindowLabel: "last_6_weeks",
    refreshedAt: "2026-06-08T00:00:00.000Z",
    isStale: false,
    partialProfileAvailable: false,
  };
}

function buildSeason(): LeaderboardSeason {
  return {
    id: "weekly-2026-06-08",
    name: "Weekly arena Jun 8",
    windowLabel: "Jun 8 - Jun 14",
    startsAt: "2026-06-08T00:00:00.000Z",
    endsAt: "2026-06-14T23:59:59.999Z",
    status: "Active",
    scoringVersion: "v1alpha1",
    promotionRule: "Top contributors move toward the next rank tier.",
    resetRule: "Weekly XP resets after the window.",
    promotionCutoffRank: 25,
    safetyCutoffRank: 75,
    explanation: "Leaderboard rows are backed by persisted season snapshots.",
  };
}
