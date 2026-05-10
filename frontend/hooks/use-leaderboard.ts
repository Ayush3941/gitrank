"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/lib/api/mock-api";
import { leaderboardByTab } from "@/lib/mock-data/gitrank";
import type { PreviewMode } from "@/types/gitrank";

export function useLeaderboard(
  tab: keyof typeof leaderboardByTab = "Global",
  preview?: PreviewMode,
) {
  return useQuery({
    queryKey: ["leaderboard", tab, preview],
    queryFn: () => getLeaderboard(tab, preview),
  });
}
