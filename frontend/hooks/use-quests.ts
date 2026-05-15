"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { getMyQuests } from "@/lib/api/quest-api";
import type { ProfileViewData } from "@/types/gitrank";

type QuestsQueryData = {
  quests: Awaited<ReturnType<typeof getMyQuests>>;
  profile: ProfileViewData;
};

export function useQuests() {
  return useQuery<QuestsQueryData>({
    queryKey: ["quests"],
    queryFn: async () => {
      const [quests, profile] = await Promise.all([getMyQuests(), getMyProfile()]);
      return {
        quests,
        profile,
      };
    },
  });
}
