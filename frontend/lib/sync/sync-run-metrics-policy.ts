const PARTIAL_SYNC_RUN_METRIC_KEYS = [
  "authored_pull_request_search_incomplete",
  "authored_pull_request_search_overflow",
  "authored_pull_request_backfill_incomplete",
  "authored_pull_request_discovery_empty",
  "authored_pull_request_zero_discovery_with_history",
  "authored_pull_requests_retryable",
  "authored_pull_requests_skipped",
  "authored_pull_requests_failed",
  "authored_pull_requests_timeouts",
  "authored_pull_request_scope_limited",
  "post_sync_refresh_failed",
  "post_sync_score_replay_failed",
  "post_sync_profile_refresh_failed",
  "post_sync_pr_reports_backfill_failed",
  "post_sync_quests_backfill_failed",
] as const;

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

export function hasPartialSyncRunMetrics(metrics?: Record<string, number>): boolean {
  if (!metrics) {
    return false;
  }
  for (const key of PARTIAL_SYNC_RUN_METRIC_KEYS) {
    if (metricCount(metrics, key) > 0) {
      return true;
    }
  }
  return false;
}

