"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuestsView } from "@/lib/api/quest-api";
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

  return useQuery<QuestsQueryData>({
    queryKey: ["quests"],
    staleTime: 30_000,
    queryFn: async () => {
      const [questsView, profile] = await Promise.all([
        getMyQuestsView(),
        queryClient.ensureQueryData({
          queryKey: myProfileQueryKey,
          queryFn: getMyProfile,
          staleTime: 60_000,
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
