"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import type { ProfileViewData } from "@/types/gitrank";

type BadgesQueryData = {
  badges: ProfileViewData["user"]["badges"];
  profile: ProfileViewData;
};

export function useBadges() {
  return useQuery<BadgesQueryData>({
    queryKey: ["badges"],
    queryFn: async () => {
      const profile = await getMyProfile();
      return {
        badges: profile.user.badges,
        profile,
      };
    },
  });
}
