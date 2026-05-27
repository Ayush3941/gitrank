export type SyncRunUiStatus = "Completed" | "Partial" | "Failed" | "Queued" | "Running" | "Other";

const COMPLETED_SYNC_RUN_STATUSES = new Set(["completed", "succeeded", "success", "done"]);
const PARTIAL_SYNC_RUN_STATUSES = new Set(["partial"]);
const QUEUED_SYNC_RUN_STATUSES = new Set(["queued", "pending"]);
const ACTIVE_SYNC_RUN_STATUSES = new Set(["running", "syncing", "in_progress"]);
const FAILED_SYNC_RUN_STATUSES = new Set(["failed", "cancelled", "canceled", "timed_out", "timeout"]);

export function isActiveSyncRunStatus(status: string): boolean {
  return ACTIVE_SYNC_RUN_STATUSES.has(normalizeSyncRunStatus(status));
}

export function syncRunStatusLabel(status: string): SyncRunUiStatus {
  const normalized = normalizeSyncRunStatus(status);
  if (PARTIAL_SYNC_RUN_STATUSES.has(normalized)) {
    return "Partial";
  }
  if (COMPLETED_SYNC_RUN_STATUSES.has(normalized)) {
    return "Completed";
  }
  if (FAILED_SYNC_RUN_STATUSES.has(normalized)) {
    return "Failed";
  }
  if (QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
    return "Queued";
  }
  if (ACTIVE_SYNC_RUN_STATUSES.has(normalized)) {
    return "Running";
  }
  return "Other";
}

function normalizeSyncRunStatus(status: string): string {
  return status.trim().toLowerCase();
}
