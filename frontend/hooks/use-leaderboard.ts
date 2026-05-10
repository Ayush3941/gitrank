"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, type LeaderboardTab } from "@/lib/api/leaderboard-api";
import type { PreviewMode } from "@/types/gitrank";

export function useLeaderboard(
  tab: LeaderboardTab = "Global",
  preview?: PreviewMode,
) {
  return useQuery({
    queryKey: ["leaderboard", tab, preview],
    queryFn: () => getLeaderboard(tab, preview),
  });
}
