"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyQuests } from "@/lib/api/quest-api";
import type { PreviewMode } from "@/types/gitrank";

export function useQuests(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["quests", preview],
    queryFn: async () => {
      if (preview) {
        const { getPreviewQuests } = await import("@/lib/demo/preview-api");
        return getPreviewQuests(preview);
      }
      return getMyQuests();
    },
  });
}
