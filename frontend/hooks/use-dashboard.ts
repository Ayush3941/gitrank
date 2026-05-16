"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuests } from "@/lib/api/quest-api";
import { getLeaderboard } from "@/lib/api/leaderboard-api";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const profile = await getMyProfile();
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
        refreshedAt: profile.refreshedAt,
      };
    },
  });
}
