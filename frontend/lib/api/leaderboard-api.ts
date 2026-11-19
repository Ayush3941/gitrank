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
import { formatUtcMonthDay } from "@/lib/formatters";
import { leaderboardLanes, type LeaderboardTab } from "@/lib/runtime/leaderboard-lane-policy";

export type { LeaderboardTab } from "@/lib/runtime/leaderboard-lane-policy";

type ApiLeaderboardEntry = {
  rank: number;
  handle: string;
  display_name: string;
  avatar_url?: string;
  level_label: string;
  rank_tier: string;
  total_xp: number;
  weekly_xp: number;
  ranking_value?: number;
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
  lane?: string;
  ranking_metric?: LeaderboardSeason["rankingMetric"];
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
  promotion_cutoff_rank?: number;
  safety_cutoff_rank?: number;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getLeaderboard(tab: LeaderboardTab): Promise<LeaderboardSnapshot> {
  const lane = leaderboardLanes[tab];
  const endpoint = lane.id === "global" ? "/api/leaderboard" : `/api/leaderboard?lane=${lane.id}`;
  const response = await fetch(endpoint, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiLeaderboardResponse;
  if ((payload.lane ?? "global") !== lane.id) {
    throw new Error("The backend did not return the requested leaderboard lane.");
  }
  if (lane.id !== "global" && (payload.entries ?? []).some((row) => !Number.isFinite(row.ranking_value))) {
    throw new Error("The leaderboard lane is missing its ranking values.");
  }
  const season = {
    ...seasonFromResponse(payload),
    rankingMetric: payload.ranking_metric ?? lane.metric,
    rankingLabel: lane.label,
  };
  const rows = presentRankedRows(
    (payload.entries ?? []).map(toLeaderboardEntry),
    tab,
    season.scoringVersion,
    season.promotionCutoffRank,
    season.safetyCutoffRank,
  );
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
    rankingValue: entry.ranking_value,
    totalXp: entry.total_xp,
    movement: entry.movement,
    focus: normalizeSkillCategory(entry.focus ?? ""),
    division: divisionForTier(normalizeRankTier(entry.rank_tier)),
    seasonXp: entry.weekly_xp,
    xpToNextRank: 0,
    promotionZone: false,
    demotionRisk: false,
    evidenceSummary: leaderboardEvidenceSummary(entry),
    scoreFormulaVersion: entry.score_version || frontendPolicy.scoreVersionFallback,
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

function presentRankedRows(
  rows: LeaderboardEntry[],
  tab: LeaderboardTab,
  scoringVersion: string,
  promotionCutoffRank: number,
  safetyCutoffRank: number,
): LeaderboardEntry[] {
  const ranked = rows.map((row) => ({
    ...row,
    rankingValue: row.rankingValue ?? (tab === "Weekly XP" ? row.weeklyXp : row.totalXp),
  }));
  return ranked.map((row, index) => {
    const nextBetterRow = ranked[index - 1];
    return {
      ...row,
      xpToNextRank: nextBetterRow && tab !== "Rising Contributors"
        ? Math.max(0, nextBetterRow.rankingValue - row.rankingValue + 1)
        : 0,
      promotionZone: row.rank <= promotionCutoffRank,
      demotionRisk: row.rank >= safetyCutoffRank,
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
        scoringVersion: payload.scoring_version ?? frontendPolicy.scoreVersionFallback,
        promotionRule: payload.promotion_rule ?? leaderboardSeasonPolicy.promotionRule,
        resetRule: payload.reset_rule ?? leaderboardSeasonPolicy.resetRule,
        promotionCutoffRank:
          payload.promotion_cutoff_rank ?? leaderboardSeasonPolicy.promotionCutoffRank,
        safetyCutoffRank:
          payload.safety_cutoff_rank ?? leaderboardSeasonPolicy.safetyCutoffRank,
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
    payload.promotion_cutoff_rank,
    payload.safety_cutoff_rank,
  );
}

function seasonFromGeneratedAt(
  generatedAt?: string,
  scoringVersion: string = frontendPolicy.scoreVersionFallback,
  promotionRule?: string,
  resetRule?: string,
  promotionCutoffRank?: number,
  safetyCutoffRank?: number,
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
  const resolvedPromotionCutoff =
    typeof promotionCutoffRank === "number" && promotionCutoffRank > 0
      ? Math.trunc(promotionCutoffRank)
      : leaderboardSeasonPolicy.promotionCutoffRank;
  const resolvedSafetyCutoff =
    typeof safetyCutoffRank === "number" && safetyCutoffRank > 0
      ? Math.max(resolvedPromotionCutoff, Math.trunc(safetyCutoffRank))
      : Math.max(resolvedPromotionCutoff, leaderboardSeasonPolicy.safetyCutoffRank);

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
    promotionCutoffRank: resolvedPromotionCutoff,
    safetyCutoffRank: resolvedSafetyCutoff,
    explanation:
      "Leaderboard rows are ordered from public profile snapshots and scoped by the selected focus tab.",
  };
}

function formatMonthDay(value: Date): string {
  return formatUtcMonthDay(value);
}

function divisionForTier(rankTier: RankTier): string {
  return divisionForRankTier(rankTier);
}

function normalizeSkillCategory(value: string): SkillCategory {
  return normalizeRuntimeSkillCategory(value);
}
