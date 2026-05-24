import type { PREvidenceState, SyncState } from "@/types/gitrank";

export type StatusTone = "muted" | "info" | "success" | "warning" | "danger";

export function toneForSyncState(state: SyncState | undefined): StatusTone {
  if (!state) {
    return "muted";
  }
  if (state === "synced") {
    return "success";
  }
  if (state === "syncing") {
    return "info";
  }
  if (state === "failed") {
    return "danger";
  }
  if (state === "partially_synced" || state === "stale" || state === "rate_limited") {
    return "warning";
  }
  return "muted";
}

export function toneForEvidenceStatus(
  status: PREvidenceState["status"] | undefined,
): StatusTone {
  if (!status) {
    return "muted";
  }
  if (status === "complete") {
    return "success";
  }
  if (status === "incomplete" || status === "ai_fallback" || status === "stale" || status === "deterministic_only" || status === "rate_limited") {
    return "warning";
  }
  return "muted";
}
