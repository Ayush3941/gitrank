"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  SyncRunActivityFilters,
  type SyncRunStatusCounts,
  type SyncRunStatusFilter,
} from "@/features/settings/components/SyncRunActivityFilters";
import {
  SyncRunActivityResults,
  type SyncRunActivityRow,
} from "@/features/settings/components/SyncRunActivityResults";
import { SyncRunActivitySummary } from "@/features/settings/components/SyncRunActivitySummary";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import {
  syncRunStatusLabelWithMetrics,
} from "@/features/settings/lib/sync-run-status";
import {
  describeSyncRunOutcome,
  metricCount,
  selectLatestActionableSyncRunOutcome,
} from "@/features/settings/lib/sync-run-diagnostics";

export function SyncRunActivityPanel({
  runs,
  lastUpdatedAt,
  lastAttemptedAt,
  lastSuccessfulAt,
  isLoading,
  isRefreshing,
  isError,
  errorMessage,
  onRefresh,
}: {
  runs: ApiSyncRunRecord[];
  lastUpdatedAt?: string;
  lastAttemptedAt?: string;
  lastSuccessfulAt?: string;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  errorMessage?: string;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SyncRunStatusFilter>("All");
  const [detailsExpandedByRunID, setDetailsExpandedByRunID] = useState<Record<string, boolean>>({});
  const canReset = search.trim().length > 0 || statusFilter !== "All";
  const deferredSearch = useDeferredValue(search);
  const filterStatusId = useId();
  const syncRunsHeadingId = useId();
  const syncRunsRegionId = useId();
  const runRows = useMemo<SyncRunActivityRow[]>(
    () =>
      runs.map((run) => {
        const uiStatus = syncRunStatusLabelWithMetrics(run.status, run.metrics);
        const label = runLabel(run);
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
      }),
    [runs],
  );
  const statusCounts = useMemo<SyncRunStatusCounts>(() => {
    const next = {
      all: runRows.length,
      completed: 0,
      partial: 0,
      queued: 0,
      running: 0,
      failed: 0,
    };
    for (const row of runRows) {
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
  }, [runRows]);
  const latestActionableOutcome = useMemo(
    () => selectLatestActionableSyncRunOutcome(runs),
    [runs],
  );
  const topRunOutcomeInsight = runRows[0]?.outcomeInsight ?? "";
  const showLatestSummaryInsight =
    !!latestActionableOutcome &&
    latestActionableOutcome.code !== "none" &&
    latestActionableOutcome.message !== topRunOutcomeInsight;
  const healthSummaryLabel =
    statusCounts.failed > 0
      ? "Sync health: attention needed"
      : statusCounts.running > 0 || statusCounts.queued > 0
        ? "Sync health: in progress"
        : statusCounts.partial > 0
          ? "Sync health: partial"
          : "Sync health: stable";
  const filteredRows = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return runRows.filter((row) => {
      const statusMatch =
        statusFilter === "All" || row.uiStatus === statusFilter;
      if (!statusMatch) {
        return false;
      }
      return term.length === 0 || row.searchableText.includes(term);
    });
  }, [deferredSearch, runRows, statusFilter]);
  function handleResetFilters() {
    setSearch("");
    setStatusFilter("All");
  }

  function handleClearSearch() {
    setSearch("");
  }

  function toggleRunDetails(runID: string) {
    setDetailsExpandedByRunID((current) => ({
      ...current,
      [runID]: !(current[runID] ?? false),
    }));
  }

  return (
    <div className="sync-runs-panel-shell space-y-4" style={{ overflowAnchor: "none" }}>
      <SyncRunActivitySummary
        headingId={syncRunsHeadingId}
        lastUpdatedAt={lastUpdatedAt}
        lastAttemptedAt={lastAttemptedAt}
        lastSuccessfulAt={lastSuccessfulAt}
        isRefreshing={isRefreshing}
        hasRuns={runs.length > 0}
        healthSummaryLabel={healthSummaryLabel}
        statusCounts={statusCounts}
        summaryInsight={showLatestSummaryInsight ? latestActionableOutcome.message : null}
        onRefresh={onRefresh}
      />
      <SyncRunActivityFilters
        search={search}
        statusFilter={statusFilter}
        statusCounts={statusCounts}
        filteredCount={filteredRows.length}
        canReset={canReset}
        filterStatusId={filterStatusId}
        resultsRegionId={syncRunsRegionId}
        onSearchChange={setSearch}
        onSearchClear={handleClearSearch}
        onStatusFilterChange={setStatusFilter}
        onResetFilters={handleResetFilters}
      />

      {isError ? (
        <ErrorState
          title="Sync log unavailable"
          description={errorMessage || "Sync activity is temporarily unavailable."}
          retryLabel={isRefreshing ? "Refreshing..." : "Retry log fetch"}
          retryDisabled={isRefreshing}
          fallbackHref=""
          onRetry={onRefresh}
        />
      ) : null}

      <SyncRunActivityResults
        resultsRegionId={syncRunsRegionId}
        headingId={syncRunsHeadingId}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        runsCount={runs.length}
        rows={filteredRows}
        detailsExpandedByRunID={detailsExpandedByRunID}
        onToggleRunDetails={toggleRunDetails}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
}

function runLabel(run: ApiSyncRunRecord): string {
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

function summarizeRunMetrics(metrics?: Record<string, number>): string {
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
    scoreReplayFailed == 0 &&
    profileRefreshFailed == 0 &&
    reportBackfillFailed == 0 &&
    questBackfillFailed == 0
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

function sanitizeSyncRunErrorMessage(value?: string): string | null {
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
