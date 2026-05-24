"use client";

import { useQuery } from "@tanstack/react-query";
import { listMySyncRuns, type ApiSyncRunListResponse } from "@/lib/api/account-api";
import { isActiveSyncRunStatus } from "@/features/settings/lib/sync-run-status";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";

const SYNC_RUNS_IDLE_REFETCH_INTERVAL_MS = 180_000;
const SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS = 45_000;
const SYNC_RUNS_IDLE_REFETCH_INTERVAL_CONSTRAINED_MS = 300_000;
const SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_CONSTRAINED_MS = 90_000;
const SYNC_RUNS_STALE_TIME_MS = 30_000;
const SYNC_RUNS_STALE_TIME_CONSTRAINED_MS = 90_000;

export function useSyncRuns(limit = 25) {
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery({
    queryKey: ["sync", "runs", limit],
    retry: false,
    queryFn: () => listMySyncRuns(limit),
    staleTime: constrainedNetwork
      ? SYNC_RUNS_STALE_TIME_CONSTRAINED_MS
      : SYNC_RUNS_STALE_TIME_MS,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: (query) =>
      hasActiveSyncRuns(query.state.data as ApiSyncRunListResponse | undefined)
        ? constrainedNetwork
          ? SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_CONSTRAINED_MS
          : SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS
        : constrainedNetwork
          ? SYNC_RUNS_IDLE_REFETCH_INTERVAL_CONSTRAINED_MS
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
