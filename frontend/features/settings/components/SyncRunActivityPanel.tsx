"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { formatDateTime, formatRelativeDays } from "@/lib/formatters";
import { hasPartialSyncRunMetrics } from "@/lib/sync/sync-run-metrics-policy";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { syncRunStatusLabel } from "@/features/settings/lib/sync-run-status";
import { describeSyncRunOutcome, metricCount } from "@/features/settings/lib/sync-run-diagnostics";

const SYNC_RUN_STATUS_FILTERS = ["All", "Completed", "Partial", "Queued", "Running", "Failed"] as const;
type SyncRunStatusFilter = (typeof SYNC_RUN_STATUS_FILTERS)[number];

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
  const canReset = search.trim().length > 0 || statusFilter !== "All";
  const filterStatusId = "settings-sync-filter-status";
  const syncRunsRegionId = "settings-sync-runs-region";
  const statusCounts = useMemo(() => {
    const next = {
      all: runs.length,
      completed: 0,
      partial: 0,
      queued: 0,
      running: 0,
      failed: 0,
    };
    for (const run of runs) {
      const status = syncRunStatusLabel(run.status);
      if (status === "Completed") {
        next.completed += 1;
      } else if (status === "Partial") {
        next.partial += 1;
      } else if (status === "Queued") {
        next.queued += 1;
      } else if (status === "Running") {
        next.running += 1;
      } else if (status === "Failed") {
        next.failed += 1;
      }
    }
    return next;
  }, [runs]);
  const filteredRuns = useMemo(() => {
    const term = search.trim().toLowerCase();
    return runs.filter((run) => {
      const normalizedStatus = syncRunStatusLabel(run.status);
      const statusMatch =
        statusFilter === "All" || normalizedStatus === statusFilter;
      if (!statusMatch) {
        return false;
      }
      if (term.length === 0) {
        return true;
      }
      return (
        runLabel(run).toLowerCase().includes(term) ||
        (run.subject ?? "").toLowerCase().includes(term) ||
        run.run_type.toLowerCase().includes(term) ||
        (run.last_error ?? "").toLowerCase().includes(term)
      );
    });
  }, [search, statusFilter, runs]);
  const resultsRegionClassName = "min-h-[12rem]";

  function handleResetFilters() {
    setSearch("");
    setStatusFilter("All");
  }

  function handleClearSearch() {
    setSearch("");
  }

  return (
    <div className="sync-runs-panel-shell space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Recent sync runs</p>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdatedAt ? (
            <p className="text-xs font-medium text-cyan-200">
              Updated{" "}
              <time
                dateTime={toNormalizedDateTime(lastUpdatedAt) ?? undefined}
                title={formatDateTime(lastUpdatedAt)}
                aria-label={`Updated ${formatRelativeDays(lastUpdatedAt)}, ${formatDateTime(lastUpdatedAt)}`}
              >
                {formatRelativeDays(lastUpdatedAt)}
              </time>
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            {isRefreshing ? "Refreshing..." : "Refresh log"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
          Last attempted{" "}
          {lastAttemptedAt ? (
            <time
              dateTime={toNormalizedDateTime(lastAttemptedAt) ?? undefined}
              title={formatDateTime(lastAttemptedAt)}
            >
              {formatRelativeDays(lastAttemptedAt)}
            </time>
          ) : (
            "never"
          )}
        </span>
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
          Last successful{" "}
          {lastSuccessfulAt ? (
            <time
              dateTime={toNormalizedDateTime(lastSuccessfulAt) ?? undefined}
              title={formatDateTime(lastSuccessfulAt)}
            >
              {formatRelativeDays(lastSuccessfulAt)}
            </time>
          ) : (
            "none yet"
          )}
        </span>
      </div>
      <div className="space-y-3">
        <p id={filterStatusId} role="status" aria-live="polite" className="sr-only">
          {`${filteredRuns.length} of ${statusCounts.all} runs`}
        </p>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
              className="pl-11 pr-11"
              placeholder="Search run subject, mode, or error"
              aria-label="Search sync runs"
              aria-describedby={filterStatusId}
            />
            {search.trim().length > 0 ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="focus-ring absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-cyan-100 hover:bg-primary/12 hover:text-white"
                aria-label="Clear sync run search"
                aria-controls={syncRunsRegionId}
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Run status</p>
            <SegmentedTablist
              options={SYNC_RUN_STATUS_FILTERS.map((status) => {
                const count =
                  status === "All"
                    ? statusCounts.all
                    : status === "Completed"
                      ? statusCounts.completed
                      : status === "Partial"
                        ? statusCounts.partial
                      : status === "Queued"
                        ? statusCounts.queued
                      : status === "Running"
                        ? statusCounts.running
                        : statusCounts.failed;
                const Icon =
                  status === "All"
                    ? Search
                    : status === "Completed"
                      ? CheckCircle2
                      : status === "Partial"
                        ? AlertTriangle
                      : status === "Queued"
                        ? Clock3
                      : status === "Running"
                        ? Clock3
                        : XCircle;
                return {
                  value: status,
                  label: status,
                  icon: <Icon className="h-4 w-4" />,
                  count,
                  minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
                };
              })}
              value={statusFilter}
              onValueChange={setStatusFilter}
              ariaLabel="Sync run status filters"
              ariaDescribedBy={filterStatusId}
              ariaControls={syncRunsRegionId}
              tabIdPrefix="sync-run-status-filter"
              wrap
            />
          </div>
          {canReset ? (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetFilters}
                aria-controls={syncRunsRegionId}
                className="h-8 px-3"
              >
                Reset filters
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {isError ? (
        <div role="alert" className="neon-surface space-y-3 border-rose-300/28 px-4 py-3 text-sm text-rose-100">
          <p>{errorMessage || "Sync activity is temporarily unavailable."}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Retry log fetch"}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        id={syncRunsRegionId}
        className="sync-runs-results-viewport h-[22rem] overflow-y-auto pr-1"
      >
        {isLoading ? (
          <div className={`neon-surface grid gap-2 px-4 py-4 text-sm text-muted ${resultsRegionClassName}`}>
            <p>Loading recent sync activity…</p>
          </div>
        ) : runs.length === 0 ? (
          <div className={`neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4 text-sm text-muted ${resultsRegionClassName}`}>
            <p>No sync runs yet. Open dashboard to start auto-sync.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard" prefetch={false}>Open dashboard</Link>
              </Button>
            </div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className={`neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4 text-sm text-muted ${resultsRegionClassName}`}>
            <p>No sync runs match this filter.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleResetFilters}
                disabled={!canReset}
              >
                Reset filters
              </Button>
            </div>
          </div>
        ) : (
          <ol role="list" className={`grid gap-2 ${resultsRegionClassName}`}>
            {filteredRuns.map((run, index) => {
              const safeLastError = sanitizeSyncRunErrorMessage(run.last_error);
              const metricsSummary = summarizeRunMetrics(run.metrics);
              const partial = hasPartialSyncRunMetrics(run.metrics);
              const outcomeInsight = describeSyncRunOutcome(run).message;
              return (
                <li key={`${run.id}-${index}`}>
                  <article className="render-opt-card neon-surface space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-anywhere text-sm font-semibold text-white">
                          {runLabel(run)}
                        </p>
                        <p className="mt-1 break-anywhere text-xs text-muted">
                          {run.subject || "No subject"} • {run.run_type}
                        </p>
                      </div>
                      <StatusChip status={run.status} partial={partial} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>
                        Started {toFriendlyTimestamp(run.started_at)}
                      </span>
                      {run.finished_at ? (
                        <span>Duration {runDuration(run.started_at, run.finished_at)}</span>
                      ) : null}
                    </div>
                    {metricsSummary ? (
                      <p className="break-anywhere text-xs text-muted">{metricsSummary}</p>
                    ) : null}
                    {outcomeInsight ? (
                      <p className="break-anywhere text-xs text-cyan-100">{outcomeInsight}</p>
                    ) : null}
                    {safeLastError ? (
                      <p className="break-anywhere text-xs text-rose-100">
                        Last error: {safeLastError}
                      </p>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function StatusChip({ status, partial = false }: { status: string; partial?: boolean }) {
  const normalized = syncRunStatusLabel(status);
  if (normalized === "Partial") {
    return (
      <span className="neon-chip neon-chip-warning inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        Partial
      </span>
    );
  }
  if (normalized === "Completed") {
    if (partial) {
      return (
        <span className="neon-chip neon-chip-warning inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Partial
        </span>
      );
    }
    return (
      <span className="neon-chip neon-chip-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Completed
      </span>
    );
  }
  if (normalized === "Failed") {
    return (
      <span className="neon-chip inline-flex items-center gap-1.5 rounded-full border-rose-300/30 bg-rose-500/12 px-2.5 py-1 text-xs font-semibold text-rose-100">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  if (normalized === "Queued") {
    return (
      <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <Clock3 className="h-3.5 w-3.5" />
        Queued
      </span>
    );
  }
  if (normalized === "Running") {
    return (
      <span className="neon-chip neon-chip-info inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <Clock3 className="h-3.5 w-3.5" />
        Running
      </span>
    );
  }
  return (
    <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
      <AlertTriangle className="h-3.5 w-3.5" />
      {status || "Unknown"}
    </span>
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

function toFriendlyTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "time pending";
  }
  return parsed.toLocaleString();
}

function runDuration(startedAt: string, finishedAt: string): string {
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return "n/a";
  }
  const totalSeconds = Math.round((end - start) / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
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

function toNormalizedDateTime(value?: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
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
