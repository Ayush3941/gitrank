import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import type { RefreshFeedback } from "@/lib/refresh-feedback";
import { canonicalizeSyncRunStatus } from "@/lib/sync/sync-run-status-policy";

export function selectLatestInFlightSyncRun(
  runs: readonly ApiSyncRunRecord[] | null | undefined,
): ApiSyncRunRecord | null {
  if (!runs?.length) {
    return null;
  }
  for (const run of runs) {
    const canonicalStatus = canonicalizeSyncRunStatus(run.status);
    if (canonicalStatus === "running" || canonicalStatus === "queued") {
      return run;
    }
  }
  return null;
}

export function buildInFlightSyncRefreshFeedback(run: ApiSyncRunRecord): RefreshFeedback {
  const canonicalStatus = canonicalizeSyncRunStatus(run.status);
  if (canonicalStatus === "queued") {
    return {
      tone: "warning",
      message:
        "A sync run is already queued for this account. This page updates automatically when that run starts and completes.",
    };
  }

  return {
    tone: "warning",
    message:
      "A sync run is already in progress for this account. Wait for it to finish before starting another refresh.",
  };
}
