"use client";

import { useQuery } from "@tanstack/react-query";
import { listMySyncRuns, type ApiSyncRunListResponse } from "@/lib/api/account-api";
import { isActiveSyncRunStatus } from "@/features/settings/lib/sync-run-status";

const SYNC_RUNS_IDLE_REFETCH_INTERVAL_MS = 90_000;
const SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS = 12_000;

export function useSyncRuns(limit = 25) {
  return useQuery({
    queryKey: ["sync", "runs", limit],
    queryFn: () => listMySyncRuns(limit),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query) =>
      hasActiveSyncRuns(query.state.data as ApiSyncRunListResponse | undefined)
        ? SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS
        : SYNC_RUNS_IDLE_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}

function hasActiveSyncRuns(payload?: ApiSyncRunListResponse): boolean {
  if (!payload?.runs?.length) {
    return false;
  }
  return payload.runs.some((run) => isActiveSyncRunStatus(run.status));
}
