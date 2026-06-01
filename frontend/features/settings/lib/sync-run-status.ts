import {
  canonicalizeSyncRunStatus,
} from "@/lib/sync/sync-run-status-policy";
import { hasPartialSyncRunMetrics } from "@/lib/sync/sync-run-metrics-policy";

export type SyncRunUiStatus = "Completed" | "Partial" | "Failed" | "Queued" | "Running" | "Other";

export function isActiveSyncRunStatus(status: string): boolean {
  return canonicalizeSyncRunStatus(status) === "running";
}

export function isInFlightSyncRunStatus(status: string): boolean {
  const canonicalStatus = canonicalizeSyncRunStatus(status);
  return canonicalStatus === "running" || canonicalStatus === "queued";
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

export function syncRunStatusLabelWithMetrics(
  status: string,
  metrics?: Record<string, number>,
): SyncRunUiStatus {
  const normalized = syncRunStatusLabel(status);
  if (normalized === "Completed" && hasPartialSyncRunMetrics(metrics)) {
    return "Partial";
  }
  return normalized;
}
