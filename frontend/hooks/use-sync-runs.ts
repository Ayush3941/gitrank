"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listMySyncRuns,
  type ApiSyncRunListResponse,
  type ListSyncRunsOptions,
} from "@/lib/api/account-api";
import { isInFlightSyncRunStatus } from "@/features/settings/lib/sync-run-status";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";

type SyncRunsQueryFilter = Pick<ListSyncRunsOptions, "runType" | "user">;

export function useSyncRuns(limit = 25, filter?: SyncRunsQueryFilter) {
  const constrainedNetwork = useNetworkConstraintPreference();
  const runType = normalizeToken(filter?.runType);
  const user = normalizeGitHubHandle(filter?.user);

  return useQuery({
    queryKey: ["sync", "runs", limit, runType, user],
    retry: false,
    queryFn: () =>
      listMySyncRuns(limit, {
        runType: runType || undefined,
        user: user || undefined,
      }),
    staleTime: constrainedNetwork
      ? syncPollingPolicy.syncRunsStaleTimeConstrainedMs
      : syncPollingPolicy.syncRunsStaleTimeMs,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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

function normalizeToken(value?: string | null): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase();
}

function normalizeGitHubHandle(value?: string | null): string {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/^@+/, "");
}

function hasActiveSyncRuns(payload?: ApiSyncRunListResponse): boolean {
  if (!payload?.runs?.length) {
    return false;
  }
  return payload.runs.some((run) => isInFlightSyncRunStatus(run.status));
}
