"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { myProfileQueryKey } from "@/hooks/use-profile";
import type { ProfileViewData } from "@/types/gitrank";

type BadgesQueryData = {
  badges: ProfileViewData["user"]["badges"];
  profile: ProfileViewData;
};

export function useBadges() {
  const queryClient = useQueryClient();
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery<BadgesQueryData>({
    queryKey: ["badges", "derived"],
    retry: false,
    staleTime: constrainedNetwork ? 120_000 : 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: async () => {
      const profile = await queryClient.ensureQueryData({
        queryKey: myProfileQueryKey,
        queryFn: getMyProfile,
        staleTime: constrainedNetwork ? 120_000 : 60_000,
      });
      return {
        badges: profile.user.badges,
        profile,
      };
    },
  });
}
