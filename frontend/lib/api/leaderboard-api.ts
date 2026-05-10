import { getLeaderboard as getMockLeaderboard } from "@/lib/api/mock-api";
import type { LeaderboardEntry, PreviewMode, RankTier, SkillCategory } from "@/types/gitrank";

export type LeaderboardTab = "Global" | "Backend" | "Testing" | "Documentation" | "Weekly XP";

type ApiLeaderboardEntry = {
  rank: number;
  handle: string;
  display_name: string;
  avatar_url?: string;
  level_label: string;
  rank_tier: string;
  total_xp: number;
  weekly_xp: number;
  movement: number;
  focus?: string;
  refreshed_at: string;
  is_stale: boolean;
};

type ApiLeaderboardResponse = {
  entries?: ApiLeaderboardEntry[];
  generated_at: string;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getLeaderboard(
  tab: LeaderboardTab,
  preview?: PreviewMode,
): Promise<LeaderboardEntry[]> {
  if (preview) {
    return getMockLeaderboard(tab, preview);
  }

  const response = await fetch("/api/leaderboard", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiLeaderboardResponse;
  return rankForTab((payload.entries ?? []).map(toLeaderboardEntry), tab);
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `Leaderboard request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || fallback;
  } catch {
    return fallback;
  }
}

function toLeaderboardEntry(entry: ApiLeaderboardEntry): LeaderboardEntry {
  return {
    rank: entry.rank,
    username: entry.handle,
    displayName: entry.display_name,
    title: entry.level_label,
    rankTier: normalizeRankTier(entry.rank_tier),
    weeklyXp: entry.weekly_xp,
    totalXp: entry.total_xp,
    movement: entry.movement,
    focus: normalizeSkillCategory(entry.focus ?? ""),
  };
}

function rankForTab(rows: LeaderboardEntry[], tab: LeaderboardTab): LeaderboardEntry[] {
  const scoped =
    tab === "Global" || tab === "Weekly XP"
      ? [...rows]
      : rows.filter((row) => row.focus === tab);
  const sorted =
    tab === "Weekly XP"
      ? scoped.sort((a, b) => b.weeklyXp - a.weeklyXp || b.totalXp - a.totalXp)
      : scoped.sort((a, b) => a.rank - b.rank);

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}

function normalizeRankTier(value: string): RankTier {
  const normalized = value.trim().toLowerCase();
  const mapped: Record<string, RankTier> = {
    bronze: "Bronze I",
    "bronze i": "Bronze I",
    silver: "Silver II",
    "silver ii": "Silver II",
    gold: "Gold III",
    "gold iii": "Gold III",
    platinum: "Platinum I",
    "platinum i": "Platinum I",
    diamond: "Diamond",
  };
  return mapped[normalized] ?? "Bronze I";
}

function normalizeSkillCategory(value: string): SkillCategory {
  const normalized = value.trim().toLowerCase();
  const mapped: Record<string, SkillCategory> = {
    architecture: "Architecture",
    backend: "Backend",
    bugfix: "Backend",
    bug_fix: "Backend",
    devops: "DevOps",
    docs: "Documentation",
    documentation: "Documentation",
    frontend: "Frontend",
    infrastructure: "DevOps",
    performance: "Performance",
    review: "Review",
    reviews: "Review",
    security: "Security",
    testing: "Testing",
    tests: "Testing",
  };
  return mapped[normalized] ?? "Backend";
}
