"use client";

import { useMemo } from "react";
import type { ApiSyncExecutionResponse, ApiSyncRunRecord } from "@/lib/api/account-api";
import type { RefreshFeedback } from "@/lib/refresh-feedback";
import { buildUserSyncRefreshFeedback } from "@/lib/sync-refresh-feedback";
import {
  buildInFlightSyncRefreshFeedback,
  selectLatestInFlightSyncRun,
} from "@/lib/sync-refresh-guard";

export function useStaleSyncRefresh({
  runs,
  isSyncPending,
  requestSync,
  refetchAfterSync,
}: {
  runs: readonly ApiSyncRunRecord[] | null | undefined;
  isSyncPending: boolean;
  requestSync: () => Promise<ApiSyncExecutionResponse>;
  refetchAfterSync: () => Promise<unknown>;
}) {
  const inFlightSyncRun = useMemo(
    () => selectLatestInFlightSyncRun(runs),
    [runs],
  );

  async function onRefresh(): Promise<RefreshFeedback> {
    if (inFlightSyncRun) {
      return buildInFlightSyncRefreshFeedback(inFlightSyncRun);
    }
    try {
      const result = await requestSync();
      return buildUserSyncRefreshFeedback(result);
    } finally {
      await refetchAfterSync();
    }
  }

  return {
    isRefreshing: isSyncPending || Boolean(inFlightSyncRun),
    onRefresh,
  };
}
