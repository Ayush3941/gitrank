"use client";

import { useSyncRuns } from "@/hooks/use-sync-runs";

export function useProfileSyncRuns(limit = 25) {
  return useSyncRuns(limit, { runType: "user" });
}
