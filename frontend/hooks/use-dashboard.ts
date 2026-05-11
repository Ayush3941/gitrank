"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuests } from "@/lib/api/quest-api";
import type { PreviewMode } from "@/types/gitrank";

export function useDashboard(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["dashboard", preview],
    queryFn: async () => {
      if (preview) {
        const { getPreviewDashboardData } = await import("@/lib/demo/preview-api");
        return getPreviewDashboardData(preview);
      }
      const [profile, quests] = await Promise.all([getMyProfile(), getMyQuests()]);
      return {
        user: {
          ...profile.user,
          quests,
        },
        recentReports: [],
      };
    },
  });
}
