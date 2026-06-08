import { buildContribution } from "@/tests/helpers/contribution-fixture";
import type {
  Badge,
  LeaderboardSeason,
  ProfileRepositorySummary,
  ProfileViewData,
  RepositoryVisibility,
  UserProfile,
} from "@/types/gitrank";

export function buildBadge(overrides: Partial<Badge> = {}): Badge {
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

export function buildPrivacy(
  overrides: Partial<UserProfile["privacy"]> = {},
): UserProfile["privacy"] {
  return {
    publicProfileEnabled: true,
    showExactPRs: true,
    showAiSummaries: true,
    showLeaderboardParticipation: true,
    badgeUnlockedNotifications: true,
    levelUpNotifications: true,
    weeklyReportNotifications: true,
    reducedGamification: false,
    ...overrides,
  };
}

export function buildLeaderboardSeason(
  overrides: Partial<LeaderboardSeason> = {},
): LeaderboardSeason {
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
    ...overrides,
  };
}

export function buildRepositoryVisibility(
  overrides: Partial<RepositoryVisibility> = {},
): RepositoryVisibility {
  return {
    name: "octo/gitrank",
    tracked: true,
    visibility: "Public",
    reason: "Visible on the public profile.",
    ...overrides,
  };
}

export function buildProfileRepositorySummary(
  overrides: Partial<ProfileRepositorySummary> = {},
): ProfileRepositorySummary {
  return {
    name: "octo/gitrank",
    owner: "octo",
    repo: "gitrank",
    totalXp: 1200,
    contributionCount: 1,
    visibility: "Public",
    primarySkill: "Testing",
    ...overrides,
  };
}

export function buildUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  const strongestSignals = overrides.strongestSignals ?? ["Testing"];
  return {
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
      season: buildLeaderboardSeason(),
      currentTier: "Bronze I",
      nextTier: "Silver II",
      seasonXp: 120,
      xpToNextTier: 300,
      promotionCutoffRank: 25,
      safetyCutoffRank: 75,
      evidenceSignals: ["profile_snapshot"],
    },
    skillTree: [],
    contributions: [
      buildContribution({
        id: "contribution-1",
        mergedAt: "2026-06-08T09:00:00.000Z",
        status: "merged",
      }),
    ],
    badges: [buildBadge()],
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
    repositories: [buildRepositoryVisibility()],
    privacy: buildPrivacy(),
    ...overrides,
  };
}

export function buildProfileViewData(
  overrides: Partial<ProfileViewData> = {},
): ProfileViewData {
  return {
    user: buildUserProfile(),
    featuredContributions: [],
    topRepositories: [buildProfileRepositorySummary()],
    recentReports: [],
    shareHeadline: "Evidence-backed profile.",
    trendWindowLabel: "last_6_weeks",
    refreshedAt: "2026-06-08T00:00:00.000Z",
    isStale: false,
    partialProfileAvailable: false,
    ...overrides,
  };
}
