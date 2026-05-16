"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuestsView } from "@/lib/api/quest-api";
import type { ProfileViewData } from "@/types/gitrank";

type QuestsQueryData = {
  quests: Awaited<ReturnType<typeof getMyQuestsView>>["quests"];
  generatedAt?: string;
  staleness?: Awaited<ReturnType<typeof getMyQuestsView>>["staleness"];
  profile: ProfileViewData;
};

export function useQuests() {
  return useQuery<QuestsQueryData>({
    queryKey: ["quests"],
    queryFn: async () => {
      const [questsView, profile] = await Promise.all([getMyQuestsView(), getMyProfile()]);
      return {
        quests: questsView.quests,
        generatedAt: questsView.generatedAt,
        staleness: questsView.staleness,
        profile,
      };
    },
  });
}
