"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuests } from "@/lib/api/quest-api";
import { getLeaderboard } from "@/lib/api/leaderboard-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { myProfileQueryKey } from "@/hooks/use-profile";

export function useDashboard() {
  const queryClient = useQueryClient();
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery({
    queryKey: ["dashboard"],
    retry: false,
    staleTime: constrainedNetwork ? 90_000 : 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: async () => {
      const profile = await queryClient.ensureQueryData({
        queryKey: myProfileQueryKey,
        queryFn: getMyProfile,
        staleTime: constrainedNetwork ? 120_000 : 60_000,
      });
      const [questsResult, leaderboardResult] = await Promise.allSettled([
        getMyQuests(),
        getLeaderboard("Global"),
      ]);
      const quests = questsResult.status === "fulfilled" ? questsResult.value : [];
      const leaderboard =
        leaderboardResult.status === "fulfilled" ? leaderboardResult.value : null;
      const current = leaderboard?.rows.find(
        (row) => row.username.toLowerCase() === profile.user.username.toLowerCase(),
      );

      const user = {
        ...profile.user,
        quests,
        rankProgress: {
          ...profile.user.rankProgress,
          season: leaderboard?.season ?? profile.user.rankProgress.season,
          seasonXp: current?.seasonXp ?? profile.user.rankProgress.seasonXp,
        },
        weeklyXp: current?.weeklyXp ?? profile.user.weeklyXp,
        leaguePosition: current?.rank ?? profile.user.leaguePosition,
        movement: current?.movement ?? profile.user.movement,
      };

      return {
        user,
        recentReports: profile.recentReports,
        trendWindowLabel: profile.trendWindowLabel,
        refreshedAt: profile.refreshedAt,
        isStale: profile.isStale,
        partialProfileAvailable: profile.partialProfileAvailable,
      };
    },
  });
}
