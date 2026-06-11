import {
  canonicalizeSyncRunStatus,
  normalizeSyncRunStatusToken,
} from "@/lib/sync/sync-run-status-policy";
import { hasPartialSyncRunMetrics } from "@/lib/sync/sync-run-metrics-policy";
import { formatTokenLabel } from "@/lib/presentation/token-label";

type KnownSyncRunUiStatus = "Completed" | "Partial" | "Failed" | "Queued" | "Running";
export type SyncRunUiStatus = KnownSyncRunUiStatus | (string & {});

export function isActiveSyncRunStatus(status: string): boolean {
  return canonicalizeSyncRunStatus(status) === "running";
}

export function isInFlightSyncRunStatus(status: string): boolean {
  const canonicalStatus = canonicalizeSyncRunStatus(status);
  return canonicalStatus === "running" || canonicalStatus === "queued";
}

export function syncRunStatusLabel(status: string): SyncRunUiStatus {
  const canonicalStatus = canonicalizeSyncRunStatus(status);
  const normalizedToken = normalizeSyncRunStatusToken(status);
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
  if (!normalizedToken || normalizedToken === "unknown") {
    return "Status unavailable";
  }
  return formatTokenLabel(normalizedToken);
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
