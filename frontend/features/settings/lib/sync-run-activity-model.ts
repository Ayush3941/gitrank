import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import {
  describeSyncRunOutcome,
  metricCount,
  selectLatestActionableSyncRunOutcome,
} from "@/features/settings/lib/sync-run-diagnostics";
import {
  syncRunStatusLabelWithMetrics,
  type SyncRunUiStatus,
} from "@/features/settings/lib/sync-run-status";

export const SYNC_RUN_STATUS_FILTERS = [
  "All",
  "Completed",
  "Partial",
  "Queued",
  "Running",
  "Failed",
] as const;

export type SyncRunStatusFilter = (typeof SYNC_RUN_STATUS_FILTERS)[number];

export type SyncRunStatusCounts = {
  all: number;
  completed: number;
  partial: number;
  queued: number;
  running: number;
  failed: number;
};

export type SyncRunActivityRow = {
  id: string;
  run: ApiSyncRunRecord;
  label: string;
  uiStatus: SyncRunUiStatus;
  searchableText: string;
  safeLastError: string | null;
  metricsSummary: string;
  outcomeInsight: string;
};

export type SyncRunActivityModelInput = {
  runs: ApiSyncRunRecord[];
  search: string;
  deferredSearch: string;
  statusFilter: SyncRunStatusFilter;
};

export function buildSyncRunActivityModel({
  runs,
  search,
  deferredSearch,
  statusFilter,
}: SyncRunActivityModelInput) {
  const rows = runs.map(toSyncRunActivityRow);
  const statusCounts = buildSyncRunStatusCounts(rows);
  const latestActionableOutcome = selectLatestActionableSyncRunOutcome(runs);
  const topRunOutcomeInsight = rows[0]?.outcomeInsight ?? "";
  const showLatestSummaryInsight =
    !!latestActionableOutcome &&
    latestActionableOutcome.code !== "none" &&
    latestActionableOutcome.message !== topRunOutcomeInsight;
  const filteredRows = filterSyncRunActivityRows({
    rows,
    deferredSearch,
    statusFilter,
  });

  return {
    rows,
    filteredRows,
    statusCounts,
    latestActionableOutcome,
    showLatestSummaryInsight,
    summaryInsight: showLatestSummaryInsight ? latestActionableOutcome.message : null,
    healthSummaryLabel: syncRunHealthSummaryLabel(statusCounts),
    canReset: search.trim().length > 0 || statusFilter !== "All",
  };
}

export function toSyncRunActivityRow(run: ApiSyncRunRecord): SyncRunActivityRow {
  const uiStatus = syncRunStatusLabelWithMetrics(run.status, run.metrics);
  const label = syncRunLabel(run);
  const safeLastError = sanitizeSyncRunErrorMessage(run.last_error);
  const metricsSummary = summarizeRunMetrics(run.metrics);
  const outcomeInsight = describeSyncRunOutcome(run).message;
  const searchableText = [
    label,
    run.subject ?? "",
    run.run_type,
    run.requested_repository ?? "",
    run.requested_user ?? "",
    run.requested_by_subject ?? "",
    run.requested_by_github_login ?? "",
    safeLastError ?? "",
    metricsSummary,
    outcomeInsight,
  ]
    .join(" ")
    .toLowerCase();

  return {
    id: run.id,
    run,
    label,
    uiStatus,
    searchableText,
    safeLastError,
    metricsSummary,
    outcomeInsight,
  };
}

export function buildSyncRunStatusCounts(
  rows: SyncRunActivityRow[],
): SyncRunStatusCounts {
  const next = {
    all: rows.length,
    completed: 0,
    partial: 0,
    queued: 0,
    running: 0,
    failed: 0,
  };
  for (const row of rows) {
    if (row.uiStatus === "Completed") {
      next.completed += 1;
    } else if (row.uiStatus === "Partial") {
      next.partial += 1;
    } else if (row.uiStatus === "Queued") {
      next.queued += 1;
    } else if (row.uiStatus === "Running") {
      next.running += 1;
    } else if (row.uiStatus === "Failed") {
      next.failed += 1;
    }
  }
  return next;
}

export function filterSyncRunActivityRows({
  rows,
  deferredSearch,
  statusFilter,
}: {
  rows: SyncRunActivityRow[];
  deferredSearch: string;
  statusFilter: SyncRunStatusFilter;
}): SyncRunActivityRow[] {
  const term = deferredSearch.trim().toLowerCase();
  return rows.filter((row) => {
    const statusMatch = statusFilter === "All" || row.uiStatus === statusFilter;
    if (!statusMatch) {
      return false;
    }
    return term.length === 0 || row.searchableText.includes(term);
  });
}

export function syncRunHealthSummaryLabel(
  statusCounts: Pick<
    SyncRunStatusCounts,
    "failed" | "partial" | "queued" | "running"
  >,
): string {
  if (statusCounts.failed > 0) {
    return "Sync health: attention needed";
  }
  if (statusCounts.running > 0 || statusCounts.queued > 0) {
    return "Sync health: in progress";
  }
  if (statusCounts.partial > 0) {
    return "Sync health: partial";
  }
  return "Sync health: stable";
}

export function syncRunLabel(run: ApiSyncRunRecord): string {
  if (run.requested_repository) {
    return run.requested_repository;
  }
  if (run.requested_user) {
    return `@${run.requested_user}`;
  }
  if (run.subject) {
    return run.subject;
  }
  return "Sync run";
}

export function summarizeRunMetrics(metrics?: Record<string, number>): string {
  if (!metrics || Object.keys(metrics).length === 0) {
    return "";
  }

  const segments: string[] = [];
  const appTokenAuth = metricCount(metrics, "auth_installation_client");
  if (appTokenAuth > 0) {
    segments.push("Auth App token");
  }
  pushMetricSegment(
    segments,
    "PRs",
    metricCount(metrics, "persisted_pull_requests", "pull_requests"),
    metricCount(metrics, "fetched_pull_requests"),
  );
  pushMetricSegment(
    segments,
    "Reviews",
    metricCount(metrics, "persisted_reviews", "reviews"),
    metricCount(metrics, "fetched_reviews"),
  );
  pushMetricSegment(
    segments,
    "Issues",
    metricCount(metrics, "persisted_issues", "issues"),
    metricCount(metrics, "fetched_issues"),
  );
  pushMetricSegment(
    segments,
    "Commits",
    metricCount(metrics, "persisted_commits", "commits"),
    metricCount(metrics, "fetched_commits"),
  );
  const failures = metricCount(metrics, "fetched_failed", "failed");
  if (failures > 0) {
    segments.push(`Failures ${failures}`);
  }
  const timeoutErrors = metricCount(metrics, "fetched_timeout_errors", "timeout_errors");
  if (timeoutErrors > 0) {
    segments.push(`Timeout ${timeoutErrors}`);
  }
  const rateLimited = metricCount(metrics, "fetched_rate_limited", "rate_limited");
  if (rateLimited > 0) {
    segments.push(`Rate limited ${rateLimited}`);
  }
  const upstreamErrors = metricCount(metrics, "fetched_upstream_errors", "upstream_errors");
  if (upstreamErrors > 0) {
    segments.push(`Upstream ${upstreamErrors}`);
  }
  const scopeLimited = metricCount(metrics, "authored_pull_request_scope_limited");
  if (scopeLimited > 0) {
    segments.push("Scope limited");
  }
  const scoreReplayFailed = metricCount(metrics, "post_sync_score_replay_failed");
  if (scoreReplayFailed > 0) {
    segments.push("Score replay failed");
  }
  const profileRefreshFailed = metricCount(metrics, "post_sync_profile_refresh_failed");
  if (profileRefreshFailed > 0) {
    segments.push("Profile refresh failed");
  }
  const reportBackfillFailed = metricCount(metrics, "post_sync_pr_reports_backfill_failed");
  if (reportBackfillFailed > 0) {
    segments.push("Report backfill failed");
  }
  const questBackfillFailed = metricCount(metrics, "post_sync_quests_backfill_failed");
  if (questBackfillFailed > 0) {
    segments.push("Quest backfill failed");
  }
  const refreshFailed = metricCount(metrics, "post_sync_refresh_failed");
  if (refreshFailed > 0) {
    segments.push("Refresh pending");
  } else if (
    metricCount(metrics, "post_sync_refresh_ok") > 0 &&
    scoreReplayFailed === 0 &&
    profileRefreshFailed === 0 &&
    reportBackfillFailed === 0 &&
    questBackfillFailed === 0
  ) {
    segments.push("Refresh settled");
  }
  const inProgressConflicts = metricCount(
    metrics,
    "fetched_user_sync_in_progress",
    "user_sync_in_progress",
    "fetched_lease_conflicts",
    "lease_conflicts",
  );
  if (inProgressConflicts > 0) {
    segments.push(`In-progress conflicts ${inProgressConflicts}`);
  }

  const skipped = metricSumBySuffix(metrics, "_skipped");
  if (skipped > 0) {
    segments.push(`Skipped ${skipped}`);
  }
  const fetchErrors = metricSumBySuffix(metrics, "_fetch_errors");
  if (fetchErrors > 0) {
    segments.push(`Fetch errors ${fetchErrors}`);
  }

  return segments.join(" · ");
}

function pushMetricSegment(
  segments: string[],
  label: string,
  persisted: number,
  fetched: number,
) {
  if (persisted <= 0 && fetched <= 0) {
    return;
  }
  if (fetched > 0) {
    segments.push(`${label} ${persisted}/${fetched}`);
    return;
  }
  segments.push(`${label} ${persisted}`);
}

function metricSumBySuffix(metrics: Record<string, number>, suffix: string): number {
  let total = 0;
  for (const [key, value] of Object.entries(metrics)) {
    if (!key.endsWith(suffix) || !Number.isFinite(value) || value <= 0) {
      continue;
    }
    total += Math.floor(value);
  }
  return total;
}

export function sanitizeSyncRunErrorMessage(value?: string): string | null {
  if (!value || !value.trim()) {
    return null;
  }
  const normalized = value.toLowerCase();
  if (
    normalized.includes("context deadline exceeded") ||
    normalized.includes("client.timeout exceeded") ||
    normalized.includes("timeout while awaiting headers") ||
    normalized.includes("timeout awaiting response headers")
  ) {
    return "GitHub timed out while fetching some metadata. Existing evidence was kept and a background retry can fill remaining gaps.";
  }
  return sanitizeUserFacingError(value, "settings-sync-runs");
}
