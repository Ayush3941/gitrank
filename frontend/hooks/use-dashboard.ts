"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/lib/api/mock-api";
import { getMyProfile } from "@/lib/api/profile-api";
import type { PreviewMode } from "@/types/gitrank";

export function useDashboard(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["dashboard", preview],
    queryFn: async () => {
      if (preview) {
        return getDashboardData(preview);
      }
      const profile = await getMyProfile();
      return {
        user: profile.user,
        recentReports: [],
      };
    },
  });
}
