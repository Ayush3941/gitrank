"use client";

import { useQuery } from "@tanstack/react-query";
import { getLeaderboard, type LeaderboardTab } from "@/lib/api/leaderboard-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";

export function useLeaderboard(tab: LeaderboardTab = "Global") {
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery({
    queryKey: ["leaderboard", tab],
    retry: false,
    staleTime: constrainedNetwork ? 90_000 : 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: (previous) => previous,
    queryFn: () => getLeaderboard(tab),
  });
}
