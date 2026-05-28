import {
  canonicalizeSyncRunStatus,
} from "@/lib/sync/sync-run-status-policy";

export type SyncRunUiStatus = "Completed" | "Partial" | "Failed" | "Queued" | "Running" | "Other";

export function isActiveSyncRunStatus(status: string): boolean {
  return canonicalizeSyncRunStatus(status) === "running";
}

export function syncRunStatusLabel(status: string): SyncRunUiStatus {
  const canonicalStatus = canonicalizeSyncRunStatus(status);
  if (canonicalStatus === "partial") {
    return "Partial";
  }
  if (canonicalStatus === "completed") {
    return "Completed";
  }
  if (canonicalStatus === "failed") {
    return "Failed";
  }
  if (canonicalStatus === "queued") {
    return "Queued";
  }
  if (canonicalStatus === "running") {
    return "Running";
  }
  return "Other";
}
