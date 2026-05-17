"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, type LeaderboardTab } from "@/lib/api/leaderboard-api";

export function useLeaderboard(tab: LeaderboardTab = "Global") {
  return useQuery({
    queryKey: ["leaderboard", tab],
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    queryFn: () => getLeaderboard(tab),
  });
}
