"use client";

import { useSyncRuns } from "@/hooks/use-sync-runs";
import { syncPollingPolicy } from "@/lib/runtime/sync-polling-policy";

export function useProfileSyncRuns(limit: number = syncPollingPolicy.profileSyncRunLookbackLimit) {
  return useSyncRuns(limit);
}
