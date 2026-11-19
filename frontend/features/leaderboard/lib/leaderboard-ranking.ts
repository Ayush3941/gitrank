import { formatPluralCount, formatXpLabel } from "@/lib/formatters";
import type { LeaderboardEntry, LeaderboardSeason } from "@/types/gitrank";

export function leaderboardRankingValue(row: LeaderboardEntry): number {
  return row.rankingValue ?? row.seasonXp;
}

export function formatLeaderboardRankingValue(value: number, season: LeaderboardSeason): string {
  return season.rankingMetric === "global_rank_movement"
    ? `${value > 0 ? "+" : ""}${formatPluralCount(value, "place")}`
    : formatXpLabel(value);
}
