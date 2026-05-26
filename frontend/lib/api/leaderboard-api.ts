import type {
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardSnapshot,
  RankTier,
  SkillCategory,
} from "@/types/gitrank";
import { frontendPolicy } from "@/lib/runtime/frontend-policy";
import {
  divisionForRankTier,
  normalizeRankTier,
} from "@/lib/runtime/rank-tier-policy";
import { normalizeSkillCategory as normalizeRuntimeSkillCategory } from "@/lib/runtime/skill-category-policy";
import { leaderboardSeasonPolicy } from "@/lib/runtime/leaderboard-season-policy";

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
  profile_snapshot_id?: string;
  profile_snapshot_version?: string;
  season_key?: string;
  season_snapshot_id?: string;
  rank_movement_event_id?: string;
  score_version?: string;
  source_watermark?: string;
  rank_evidence_state?: "complete" | "partial";
  rank_evidence_missing?: string[];
  refreshed_at: string;
  is_stale: boolean;
};

type ApiLeaderboardResponse = {
  entries?: ApiLeaderboardEntry[];
  generated_at?: string;
  season_key?: string;
  window?: {
    label?: string;
    bucket?: string;
    start_at?: string;
    end_at?: string;
  };
  scoring_version?: string;
  promotion_rule?: string;
  reset_rule?: string;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getLeaderboard(tab: LeaderboardTab): Promise<LeaderboardSnapshot> {
  const response = await fetch("/api/leaderboard", {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiLeaderboardResponse;
  const season = seasonFromResponse(payload);
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
    evidenceSummary: leaderboardEvidenceSummary(entry),
    scoreFormulaVersion: entry.score_version || "unknown",
    profileSnapshotId: entry.profile_snapshot_id,
    profileSnapshotVersion: entry.profile_snapshot_version,
    seasonKey: entry.season_key,
    seasonSnapshotId: entry.season_snapshot_id,
    rankMovementEventId: entry.rank_movement_event_id,
    sourceWatermark: entry.source_watermark,
    rankEvidenceState: entry.rank_evidence_state,
    rankEvidenceMissing: entry.rank_evidence_missing,
  };
}

function leaderboardEvidenceSummary(entry: ApiLeaderboardEntry): string {
  if (entry.is_stale) {
    return "Stale public profile snapshot; rank may lag behind recent work.";
  }
  if (entry.rank_evidence_missing?.length) {
    return `Profile snapshot rank with pending evidence ledgers: ${entry.rank_evidence_missing.join(", ")}.`;
  }
  return "Verified season snapshot with rank movement and bounded scoring evidence.";
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

function seasonFromResponse(payload: ApiLeaderboardResponse): LeaderboardSeason {
  if (payload.window?.start_at && payload.window?.end_at) {
    const startsAt = new Date(payload.window.start_at);
    const endsAt = new Date(payload.window.end_at);
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime())) {
      const labelEndsAt = new Date(endsAt);
      if (
        labelEndsAt.getUTCHours() === 0 &&
        labelEndsAt.getUTCMinutes() === 0 &&
        labelEndsAt.getUTCSeconds() === 0 &&
        labelEndsAt.getUTCMilliseconds() === 0
      ) {
        labelEndsAt.setUTCDate(labelEndsAt.getUTCDate() - 1);
      }
      return {
        id: payload.season_key ?? payload.window.label ?? `weekly-${startsAt.toISOString().slice(0, 10)}`,
        name: `Weekly arena ${formatMonthDay(startsAt)}`,
        windowLabel: `${formatMonthDay(startsAt)} - ${formatMonthDay(labelEndsAt)}`,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: "Active",
        scoringVersion: payload.scoring_version ?? "unknown",
        promotionRule: payload.promotion_rule ?? leaderboardSeasonPolicy.promotionRule,
        resetRule: payload.reset_rule ?? leaderboardSeasonPolicy.resetRule,
        explanation:
          "Leaderboard rows are backed by persisted season snapshots and rank movement events.",
      };
    }
  }
  return seasonFromGeneratedAt(
    payload.generated_at,
    payload.scoring_version,
    payload.promotion_rule,
    payload.reset_rule,
  );
}

function seasonFromGeneratedAt(
  generatedAt?: string,
  scoringVersion = frontendPolicy.scoreVersionFallback,
  promotionRule?: string,
  resetRule?: string,
): LeaderboardSeason {
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
    promotionRule: promotionRule ?? leaderboardSeasonPolicy.promotionRule,
    resetRule: resetRule ?? leaderboardSeasonPolicy.resetRule,
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
  return divisionForRankTier(rankTier);
}

function normalizeSkillCategory(value: string): SkillCategory {
  return normalizeRuntimeSkillCategory(value);
}
