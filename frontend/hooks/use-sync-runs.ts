"use client";

import { useQuery } from "@tanstack/react-query";
import { listMySyncRuns, type ApiSyncRunListResponse } from "@/lib/api/account-api";
import { isActiveSyncRunStatus } from "@/features/settings/lib/sync-run-status";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";

export function useSyncRuns(limit = 25) {
  const constrainedNetwork = useNetworkConstraintPreference();

  return useQuery({
    queryKey: ["sync", "runs", limit],
    retry: false,
    queryFn: () => listMySyncRuns(limit),
    staleTime: constrainedNetwork
      ? syncPollingPolicy.syncRunsStaleTimeConstrainedMs
      : syncPollingPolicy.syncRunsStaleTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: (query) =>
      hasActiveSyncRuns(query.state.data as ApiSyncRunListResponse | undefined)
        ? constrainedNetwork
          ? syncPollingPolicy.syncRunsActiveRefetchIntervalConstrainedMs
          : syncPollingPolicy.syncRunsActiveRefetchIntervalMs
        : constrainedNetwork
          ? syncPollingPolicy.syncRunsIdleRefetchIntervalConstrainedMs
          : syncPollingPolicy.syncRunsIdleRefetchIntervalMs,
    refetchIntervalInBackground: false,
  });
}

function hasActiveSyncRuns(payload?: ApiSyncRunListResponse): boolean {
  if (!payload?.runs?.length) {
    return false;
  }
  return payload.runs.some((run) => isActiveSyncRunStatus(run.status));
}
