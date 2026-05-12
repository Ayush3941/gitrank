"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuests } from "@/lib/api/quest-api";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [profile, quests] = await Promise.all([getMyProfile(), getMyQuests()]);
      return {
        user: {
          ...profile.user,
          quests,
        },
        recentReports: profile.recentReports,
      };
    },
  });
}
