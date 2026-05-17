"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { myProfileQueryKey } from "@/hooks/use-profile";
import type { ProfileViewData } from "@/types/gitrank";

type BadgesQueryData = {
  badges: ProfileViewData["user"]["badges"];
  profile: ProfileViewData;
};

export function useBadges() {
  const queryClient = useQueryClient();

  return useQuery<BadgesQueryData>({
    queryKey: ["badges", "derived"],
    staleTime: 60_000,
    queryFn: async () => {
      const profile = await queryClient.ensureQueryData({
        queryKey: myProfileQueryKey,
        queryFn: getMyProfile,
        staleTime: 60_000,
      });
      return {
        badges: profile.user.badges,
        profile,
      };
    },
  });
}
