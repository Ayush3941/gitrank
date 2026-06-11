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

export function formatSyncStateLabel(state: SyncState | undefined): string {
  if (!state) {
    return "Unavailable";
  }
  if (state === "never_synced") return "Never synced";
  if (state === "partially_synced") return "Partially synced";
  if (state === "rate_limited") return "Rate limited";
  if (state === "syncing") return "Syncing";
  if (state === "stale") return "Stale";
  if (state === "failed") return "Failed";
  if (state === "synced") return "Synced";
  return formatUnknownStatusLabel(state);
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

export function formatEvidenceStatusLabel(
  status: PREvidenceState["status"] | undefined,
): string {
  if (!status) {
    return "Unavailable";
  }
  if (status === "complete") {
    return "Complete";
  }
  if (status === "incomplete") {
    return "Incomplete";
  }
  if (status === "stale") {
    return "Stale";
  }
  if (status === "deterministic_only") {
    return "Deterministic only";
  }
  if (status === "rate_limited") {
    return "Rate limited";
  }
  if (status === "ai_fallback") {
    return "AI fallback";
  }
  return formatUnknownStatusLabel(status);
}

function formatUnknownStatusLabel(status: string): string {
  return status.replaceAll("_", " ");
}
