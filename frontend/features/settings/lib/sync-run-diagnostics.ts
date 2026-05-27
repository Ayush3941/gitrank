import type { ApiSyncRunRecord } from "@/lib/api/account-api";

export type SyncRunDiagnostic = {
  code:
    | "zero_discovery_with_history"
    | "scope_limited"
    | "search_limited"
    | "retryable_or_timeout"
    | "backfill_incomplete"
    | "snapshot_refresh_pending"
    | "discovery_empty"
    | "synced_targets"
    | "none";
  message: string;
};

export function describeSyncRunOutcome(run: ApiSyncRunRecord): SyncRunDiagnostic {
  const metrics = run.metrics;
  if (!metrics) {
    return {
      code: "none",
      message: "",
    };
  }

  const scopeLimited = metricCount(metrics, "authored_pull_request_scope_limited") > 0;
  const discoveryEmpty = metricCount(metrics, "authored_pull_request_discovery_empty") > 0;
  const persistedExisting = metricCount(metrics, "authored_pull_request_persisted_existing") > 0;
  const zeroDiscoveryWithHistory =
    metricCount(metrics, "authored_pull_request_zero_discovery_with_history") > 0 ||
    (discoveryEmpty && persistedExisting);
  const backfillIncomplete = metricCount(metrics, "authored_pull_request_backfill_incomplete") > 0;
  const searchIncomplete = metricCount(metrics, "authored_pull_request_search_incomplete") > 0;
  const searchOverflow = metricCount(metrics, "authored_pull_request_search_overflow") > 0;
  const retryable = metricCount(metrics, "authored_pull_requests_retryable") > 0;
  const timeout = metricCount(metrics, "authored_pull_requests_timeouts", "fetched_timeout_errors", "timeout_errors") > 0;
  const snapshotRefreshPending = metricCount(metrics, "post_sync_refresh_failed") > 0;
  const selectedAuthoredPRs = metricCount(metrics, "authored_pull_requests_selected");

  if (zeroDiscoveryWithHistory) {
    return {
      code: "zero_discovery_with_history",
      message:
        "No authored PRs were discovered in this run even though historical PR evidence already exists. Reconnect GitHub if scope changed, then retry.",
    };
  }
  if (scopeLimited) {
    return {
      code: "scope_limited",
      message:
        "GitHub returned limited authorization scope for authored PR discovery. Reconnect GitHub to expand accessible PR evidence.",
    };
  }
  if (discoveryEmpty) {
    return {
      code: "discovery_empty",
      message: "No authored PRs were discovered for the current sync window yet.",
    };
  }
  if (searchIncomplete || searchOverflow) {
    return {
      code: "search_limited",
      message:
        "GitHub search limits were hit during authored PR discovery. GitRank will continue bounded backfill on later runs.",
    };
  }
  if (retryable || timeout) {
    return {
      code: "retryable_or_timeout",
      message:
        "Some authored PR surfaces were retryable or timed out. Existing evidence was kept and later sync runs can fill missing rows.",
    };
  }
  if (backfillIncomplete) {
    return {
      code: "backfill_incomplete",
      message: "Recent PR evidence is synced. Historical authored PR backfill is still in progress.",
    };
  }
  if (snapshotRefreshPending) {
    return {
      code: "snapshot_refresh_pending",
      message: "Sync completed, but profile snapshot refresh is still finishing.",
    };
  }
  if (selectedAuthoredPRs > 0) {
    return {
      code: "synced_targets",
      message: `Synced ${selectedAuthoredPRs} authored PR target${selectedAuthoredPRs === 1 ? "" : "s"} in this run.`,
    };
  }
  return {
    code: "none",
    message: "",
  };
}

export function metricCount(metrics: Record<string, number>, ...keys: string[]): number {
  let count = 0;
  for (const key of keys) {
    const value = metrics[key];
    if (!Number.isFinite(value)) {
      continue;
    }
    const rounded = Math.max(0, Math.floor(value));
    if (rounded > count) {
      count = rounded;
    }
  }
  return count;
}
