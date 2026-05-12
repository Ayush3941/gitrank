"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyQuests } from "@/lib/api/quest-api";

export function useQuests() {
  return useQuery({
    queryKey: ["quests"],
    queryFn: getMyQuests,
  });
}
