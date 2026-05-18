"use client";

import { useQuery } from "@tanstack/react-query";
import { listMySyncRuns } from "@/lib/api/account-api";

export function useSyncRuns(limit = 25) {
  return useQuery({
    queryKey: ["sync", "runs", limit],
    queryFn: () => listMySyncRuns(limit),
    staleTime: 30_000,
    refetchInterval: 90_000,
    refetchIntervalInBackground: false,
  });
}
