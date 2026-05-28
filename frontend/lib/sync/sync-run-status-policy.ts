export const COMPLETED_SYNC_RUN_STATUSES = new Set(["completed", "succeeded", "success", "done"]);
export const PARTIAL_SYNC_RUN_STATUSES = new Set(["partial"]);
export const FAILED_SYNC_RUN_STATUSES = new Set(["failed", "cancelled", "canceled", "timed_out", "timeout"]);
export const ACTIVE_SYNC_RUN_STATUSES = new Set(["running", "syncing", "in_progress"]);
export const QUEUED_SYNC_RUN_STATUSES = new Set(["queued", "pending"]);

export type CanonicalSyncRunStatus =
  | "completed"
  | "partial"
  | "failed"
  | "running"
  | "queued"
  | "other";

export function normalizeSyncRunStatusToken(status: string): string {
  return status.trim().toLowerCase();
}

export function canonicalizeSyncRunStatus(status: string): CanonicalSyncRunStatus {
  const normalized = normalizeSyncRunStatusToken(status);
  if (PARTIAL_SYNC_RUN_STATUSES.has(normalized)) {
    return "partial";
  }
  if (COMPLETED_SYNC_RUN_STATUSES.has(normalized)) {
    return "completed";
  }
  if (FAILED_SYNC_RUN_STATUSES.has(normalized)) {
    return "failed";
  }
  if (QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
    return "queued";
  }
  if (ACTIVE_SYNC_RUN_STATUSES.has(normalized)) {
    return "running";
  }
  return "other";
}
