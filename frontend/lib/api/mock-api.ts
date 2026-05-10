import {
  ayushProfile,
  dashboardData,
  leaderboardSnapshots,
  prAnalyses,
} from "@/lib/mock-data/gitrank";
import type {
  Badge,
  DashboardData,
  LeaderboardSnapshot,
  PreviewMode,
  PullRequestAnalysis,
  Quest,
  UserProfile,
} from "@/types/gitrank";

type ContributionQuery = {
  filter?: string;
  search?: string;
  sort?: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact";
  preview?: PreviewMode;
};

const DEFAULT_DELAY = 650;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function staleProfile(profile: UserProfile) {
  const next = clone(profile);
  next.syncStatus = {
    ...next.syncStatus,
    state: "stale",
    lastSyncedAt: "2026-04-29T16:25:00.000Z",
    currentStep: "Profile data is older than 6 days",
    partialProfileAvailable: true,
  };
  return next;
}

async function withPreview<T>(
  value: T,
  preview: PreviewMode = "default",
  fallbackEmpty: T,
): Promise<T> {
  if (preview === "loading") {
    await wait(1800);
  } else {
    await wait(DEFAULT_DELAY);
  }

  if (preview === "error") {
    throw new Error("Mock GitHub sync failed while building this view.");
  }

  if (preview === "empty") {
    return clone(fallbackEmpty);
  }

  return clone(value);
}

export async function getDashboardData(preview?: PreviewMode): Promise<DashboardData> {
  const data =
    preview === "stale"
      ? { ...dashboardData, user: staleProfile(dashboardData.user) }
      : dashboardData;
  return withPreview(data, preview, {
    user: { ...ayushProfile, contributions: [], badges: [], quests: [], scoreChanges: [], xpTimeline: [] },
    recentReports: [],
  });
}

export async function getUserProfile(
  username: string,
  preview?: PreviewMode,
): Promise<UserProfile | null> {
  if (username.toLowerCase() !== ayushProfile.username.toLowerCase()) {
    await wait(300);
    return null;
  }

  const profile = preview === "stale" ? staleProfile(ayushProfile) : ayushProfile;
  return withPreview(profile, preview, {
    ...profile,
    badges: [],
    contributions: [],
    quests: [],
    scoreChanges: [],
    xpTimeline: [],
  });
}

export async function getContributions({
  filter = "All",
  search = "",
  sort = "Newest",
  preview = "default",
}: ContributionQuery) {
  const normalizedFilter = filter.toLowerCase();
  const term = search.trim().toLowerCase();
  let rows = [...ayushProfile.contributions];

  rows = rows.filter((item) => {
    const categoryMatch =
      normalizedFilter === "all" ||
      normalizedFilter === "high xp" ||
      normalizedFilter === item.status ||
      normalizedFilter === item.category.toLowerCase();

    const highXpMatch = normalizedFilter !== "high xp" || item.xpEarned >= 500;
    const searchMatch =
      term.length === 0 ||
      item.title.toLowerCase().includes(term) ||
      `${item.owner}/${item.repo}`.toLowerCase().includes(term);

    return categoryMatch && highXpMatch && searchMatch;
  });

  const sorters = {
    Newest: (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime(),
    "Highest XP": (a: (typeof rows)[number], b: (typeof rows)[number]) => b.xpEarned - a.xpEarned,
    "Highest Difficulty": (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      b.difficultyScore - a.difficultyScore,
    "Highest Impact": (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      b.impactScore - a.impactScore,
  };

  rows.sort(sorters[sort]);

  return withPreview(rows, preview, []);
}

export async function getBadges(preview?: PreviewMode): Promise<Badge[]> {
  return withPreview(ayushProfile.badges, preview, []);
}

export async function getQuests(preview?: PreviewMode): Promise<Quest[]> {
  return withPreview(ayushProfile.quests, preview, []);
}

export async function getLeaderboard(
  tab: keyof typeof leaderboardSnapshots,
  preview?: PreviewMode,
): Promise<LeaderboardSnapshot> {
  const empty = {
    ...(leaderboardSnapshots[tab] ?? leaderboardSnapshots.Global),
    rows: [],
    currentUser: undefined,
  };
  return withPreview(leaderboardSnapshots[tab] ?? leaderboardSnapshots.Global, preview, empty);
}

export async function getPrReport(
  owner: string,
  repo: string,
  number: number,
  preview?: PreviewMode,
): Promise<PullRequestAnalysis | null> {
  const report =
    prAnalyses.find(
      (item) =>
        item.contribution.owner.toLowerCase() === owner.toLowerCase() &&
        item.contribution.repo.toLowerCase() === repo.toLowerCase() &&
        item.contribution.number === number,
    ) ?? null;

  if (!report) {
    await wait(300);
    return null;
  }

  return withPreview(report, preview, null);
}
