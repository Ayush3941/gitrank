"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuestsView } from "@/lib/api/quest-api";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { myProfileQueryKey } from "@/hooks/use-profile";
import type { ProfileViewData } from "@/types/gitrank";

type QuestsQueryData = {
  quests: Awaited<ReturnType<typeof getMyQuestsView>>["quests"];
  generatedAt?: string;
  staleness?: Awaited<ReturnType<typeof getMyQuestsView>>["staleness"];
  profile: ProfileViewData;
};

export function useQuests() {
  const queryClient = useQueryClient();
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery<QuestsQueryData>({
    queryKey: ["quests"],
    retry: false,
    staleTime: constrainedNetwork ? 90_000 : 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    queryFn: async () => {
      const [questsView, profile] = await Promise.all([
        getMyQuestsView(),
        queryClient.ensureQueryData({
          queryKey: myProfileQueryKey,
          queryFn: getMyProfile,
          staleTime: constrainedNetwork ? 120_000 : 60_000,
        }),
      ]);
      return {
        quests: questsView.quests,
        generatedAt: questsView.generatedAt,
        staleness: questsView.staleness,
        profile,
      };
    },
  });
}
