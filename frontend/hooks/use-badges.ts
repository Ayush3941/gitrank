"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";

export function useBadges() {
  return useQuery({
    queryKey: ["badges"],
    queryFn: async () => {
      const profile = await getMyProfile();
      return profile.user.badges;
    },
  });
}
