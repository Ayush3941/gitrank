import { getLeaderboard as getMockLeaderboard } from "@/lib/api/mock-api";
import type {
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardSnapshot,
  PreviewMode,
  RankTier,
  SkillCategory,
} from "@/types/gitrank";

export type LeaderboardTab =
  | "Global"
  | "Backend"
  | "Testing"
  | "Documentation"
  | "Weekly XP"
  | "Rising Contributors";

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
  generated_at?: string;
  scoring_version?: string;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getLeaderboard(
  tab: LeaderboardTab,
  preview?: PreviewMode,
): Promise<LeaderboardSnapshot> {
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
  const season = seasonFromGeneratedAt(payload.generated_at, payload.scoring_version);
  const rows = rankForTab((payload.entries ?? []).map(toLeaderboardEntry), tab, season.scoringVersion);
  return {
    season,
    rows,
    currentUser: rows.find((row) => row.isCurrentUser),
  };
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
    division: divisionForTier(normalizeRankTier(entry.rank_tier)),
    seasonXp: entry.weekly_xp,
    xpToNextRank: 0,
    promotionZone: false,
    demotionRisk: false,
    evidenceSummary:
      entry.is_stale
        ? "Stale public profile snapshot; rank may lag behind recent work."
        : "Verified public profile snapshot with bounded scoring evidence.",
    scoreFormulaVersion: "unknown",
  };
}

function rankForTab(
  rows: LeaderboardEntry[],
  tab: LeaderboardTab,
  scoringVersion: string,
): LeaderboardEntry[] {
  const scoped =
    tab === "Global" || tab === "Weekly XP" || tab === "Rising Contributors"
      ? [...rows]
      : rows.filter((row) => row.focus === tab);
  const sorted =
    tab === "Weekly XP"
      ? scoped.sort((a, b) => b.weeklyXp - a.weeklyXp || b.totalXp - a.totalXp)
      : tab === "Rising Contributors"
        ? scoped.sort((a, b) => b.movement - a.movement || b.weeklyXp - a.weeklyXp)
        : scoped.sort((a, b) => a.rank - b.rank);

  return sorted.map((row, index) => {
    const nextBetterRow = sorted[index - 1];
    return {
      ...row,
      rank: index + 1,
      seasonXp: row.seasonXp || row.weeklyXp,
      xpToNextRank: nextBetterRow
        ? Math.max(0, (nextBetterRow.seasonXp || nextBetterRow.weeklyXp) - (row.seasonXp || row.weeklyXp) + 1)
        : 0,
      promotionZone: index < 3,
      demotionRisk: index >= Math.max(3, sorted.length - 2),
      scoreFormulaVersion: scoringVersion,
    };
  });
}

function seasonFromGeneratedAt(generatedAt?: string, scoringVersion = "v1alpha1"): LeaderboardSeason {
  const generated =
    !generatedAt || Number.isNaN(Date.parse(generatedAt)) ? new Date() : new Date(generatedAt);
  const day = generated.getUTCDay();
  const distanceFromMonday = (day + 6) % 7;
  const startsAt = new Date(generated);
  startsAt.setUTCDate(generated.getUTCDate() - distanceFromMonday);
  startsAt.setUTCHours(0, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(startsAt.getUTCDate() + 6);
  endsAt.setUTCHours(23, 59, 59, 999);

  return {
    id: `weekly-${startsAt.toISOString().slice(0, 10)}`,
    name: `Weekly arena ${formatMonthDay(startsAt)}`,
    windowLabel: `${formatMonthDay(startsAt)} - ${formatMonthDay(endsAt)}`,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "Active",
    scoringVersion,
    promotionRule: "Top 25 move toward the next rank tier when the season locks.",
    resetRule: "Weekly XP resets after the window; total XP and score evidence are retained.",
    explanation:
      "Leaderboard rows are ordered from public profile snapshots and scoped by the selected focus tab.",
  };
}

function formatMonthDay(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function divisionForTier(rankTier: RankTier): string {
  const base = rankTier.split(" ")[0];
  const mapped: Record<string, string> = {
    Bronze: "Bronze Foundry",
    Silver: "Silver Workshop",
    Gold: "Gold Forge",
    Platinum: "Platinum Crucible",
    Diamond: "Diamond Arena",
  };
  return mapped[base] ?? "Open Arena";
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
