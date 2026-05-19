export type SyncRunUiStatus = "Completed" | "Failed" | "Running" | "Other";

const COMPLETED_SYNC_RUN_STATUSES = new Set(["completed", "succeeded", "success", "done"]);
const ACTIVE_SYNC_RUN_STATUSES = new Set(["queued", "pending", "running", "syncing", "in_progress"]);
const FAILED_SYNC_RUN_STATUSES = new Set(["failed", "cancelled", "canceled", "timed_out", "timeout"]);

export function isActiveSyncRunStatus(status: string): boolean {
  return ACTIVE_SYNC_RUN_STATUSES.has(normalizeSyncRunStatus(status));
}

export function syncRunStatusLabel(status: string): SyncRunUiStatus {
  const normalized = normalizeSyncRunStatus(status);
  if (COMPLETED_SYNC_RUN_STATUSES.has(normalized)) {
    return "Completed";
  }
  if (FAILED_SYNC_RUN_STATUSES.has(normalized)) {
    return "Failed";
  }
  if (ACTIVE_SYNC_RUN_STATUSES.has(normalized)) {
    return "Running";
  }
  return "Other";
}

function normalizeSyncRunStatus(status: string): string {
  return status.trim().toLowerCase();
}
