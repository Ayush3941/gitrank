"use client";

import { useQuery } from "@tanstack/react-query";
import { getQuests } from "@/lib/api/mock-api";
import type { PreviewMode } from "@/types/gitrank";

export function useQuests(preview?: PreviewMode) {
  return useQuery({
    queryKey: ["quests", preview],
    queryFn: () => getQuests(preview),
  });
}
