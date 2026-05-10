"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import type { PreviewMode } from "@/types/gitrank";

export function useBadges(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["badges", preview],
    queryFn: async () => {
      const profile = await getMyProfile(preview);
      return profile.user.badges;
    },
  });
}
