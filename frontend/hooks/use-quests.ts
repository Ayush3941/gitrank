"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyQuests } from "@/lib/api/quest-api";
import type { PreviewMode } from "@/types/gitrank";

export function useQuests(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["quests", preview],
    queryFn: async () => {
      if (preview) {
        const { getQuests } = await import("@/lib/api/mock-api");
        return getQuests(preview);
      }
      return getMyQuests();
    },
  });
}
