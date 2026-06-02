"use client";

import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { ScrollableRegion } from "@/components/shared/ScrollableRegion";
import { SearchInputWithClear } from "@/components/shared/SearchInputWithClear";
import { Button } from "@/components/ui/button";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { formatDateTime, formatRelativeDays } from "@/lib/formatters";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import {
  syncRunStatusLabel,
  syncRunStatusLabelWithMetrics,
  type SyncRunUiStatus,
} from "@/features/settings/lib/sync-run-status";
import {
  describeSyncRunOutcome,
  metricCount,
  selectLatestActionableSyncRunOutcome,
} from "@/features/settings/lib/sync-run-diagnostics";

const SYNC_RUN_STATUS_FILTERS = ["All", "Completed", "Partial", "Queued", "Running", "Failed"] as const;
type SyncRunStatusFilter = (typeof SYNC_RUN_STATUS_FILTERS)[number];
type SyncRunStatusCounts = {
  all: number;
  completed: number;
  partial: number;
  queued: number;
  running: number;
  failed: number;
};
type SyncRunRow = {
  id: string;
  run: ApiSyncRunRecord;
  label: string;
  uiStatus: SyncRunUiStatus;
  searchableText: string;
  safeLastError: string | null;
  metricsSummary: string;
  outcomeInsight: string;
};

const SYNC_RUN_STATUS_META: Record<SyncRunStatusFilter, { countKey: keyof SyncRunStatusCounts }> = {
  All: { countKey: "all" },
  Completed: { countKey: "completed" },
  Partial: { countKey: "partial" },
  Queued: { countKey: "queued" },
  Running: { countKey: "running" },
  Failed: { countKey: "failed" },
};

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
  const runRows = useMemo<SyncRunRow[]>(
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
  const resultsRegionClassName = "min-h-[12rem]";

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={syncRunsHeadingId} className="text-sm font-semibold text-white">
          Recent sync runs
        </p>
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
      {runs.length > 0 ? (
        <div className="neon-surface space-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-white">{healthSummaryLabel}</p>
            <p className="text-xs text-muted">
              Completed {statusCounts.completed} · Partial {statusCounts.partial} · Running {statusCounts.running} · Failed {statusCounts.failed}
            </p>
          </div>
          {showLatestSummaryInsight ? (
            <p className="text-xs leading-5 text-cyan-100">{latestActionableOutcome.message}</p>
          ) : null}
        </div>
      ) : null}
      <ControlSurface as="section">
        <p id={filterStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {`${filteredRows.length} of ${statusCounts.all} runs`}
        </p>
        <div className="space-y-3">
          <SearchInputWithClear
            value={search}
            onChange={(value) => {
              setSearch(value);
            }}
            onClear={handleClearSearch}
            placeholder="Search run subject, mode, or error"
            ariaLabel="Search sync runs"
            ariaDescribedBy={filterStatusId}
            ariaControls={syncRunsRegionId}
            clearButtonLabel="Clear sync run search"
            inputClassName="pl-11 pr-11"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Run status</p>
            <label className="sr-only" htmlFor="sync-run-status-filter-select">
              Sync run status filter
            </label>
            <select
              id="sync-run-status-filter-select"
              value={statusFilter}
              aria-describedby={filterStatusId}
              aria-controls={syncRunsRegionId}
              onChange={(event) => {
                setStatusFilter(event.target.value as SyncRunStatusFilter);
              }}
              className="focus-ring h-10 w-full rounded-[0.1rem] border border-primary/24 bg-slate-950/60 px-3 text-sm text-white"
            >
              {SYNC_RUN_STATUS_FILTERS.map((status) => {
                const meta = SYNC_RUN_STATUS_META[status];
                return (
                  <option key={status} value={status}>
                    {status} ({statusCounts[meta.countKey]})
                  </option>
                );
              })}
            </select>
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
      </ControlSurface>

      {isError ? (
        <div className="neon-surface space-y-3 border-rose-300/28 px-4 py-3 text-sm text-rose-100">
          <p role="alert">{errorMessage || "Sync activity is temporarily unavailable."}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={onRefresh} disabled={isRefreshing}>
              {isRefreshing ? "Refreshing..." : "Retry log fetch"}
            </Button>
          </div>
        </div>
      ) : null}

      <ScrollableRegion
        id={syncRunsRegionId}
        labelledById={syncRunsHeadingId}
        aria-busy={isLoading || isRefreshing}
        className="sync-runs-results-viewport overflow-y-auto pr-1"
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
                <IntentPrefetchLink href="/dashboard">Open dashboard</IntentPrefetchLink>
              </Button>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
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
            {filteredRows.map((row) => {
              const run = row.run;
              const detailsAvailable = Boolean(
                row.outcomeInsight || row.safeLastError || run.correlation_id,
              );
              const defaultDetailsExpanded =
                row.uiStatus === "Failed" || row.uiStatus === "Partial";
              const detailsExpanded = detailsAvailable
                ? (detailsExpandedByRunID[row.id] ?? defaultDetailsExpanded)
                : false;
              const detailsRegionID = `${syncRunsRegionId}-${row.id}-details`;
              const detailsButtonID = `${syncRunsRegionId}-${row.id}-details-button`;
              return (
                <li key={row.id}>
                  <article className="render-opt-card neon-surface space-y-2 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-anywhere text-sm font-semibold text-white">
                          {row.label}
                        </p>
                        <p className="mt-1 break-anywhere text-xs text-muted">
                          {run.subject || "No subject"} • {run.run_type}
                        </p>
                      </div>
                      <StatusChip status={run.status} uiStatus={row.uiStatus} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>
                        Started {toFriendlyTimestamp(run.started_at)}
                      </span>
                      {run.finished_at ? (
                        <span>Duration {runDuration(run.started_at, run.finished_at)}</span>
                      ) : null}
                    </div>
                    {row.metricsSummary ? (
                      <p className="break-anywhere text-xs text-muted">{row.metricsSummary}</p>
                    ) : null}
                    {detailsAvailable ? (
                      <div className="space-y-2">
                        <DisclosureToggle
                          id={detailsButtonID}
                          controlsId={detailsRegionID}
                          expanded={detailsExpanded}
                          onToggle={() => {
                            toggleRunDetails(row.id);
                          }}
                          collapsedLabel="Details"
                          expandedLabel="Hide run details"
                        />
                        <div
                          id={detailsRegionID}
                          role="region"
                          aria-labelledby={detailsButtonID}
                          hidden={!detailsExpanded}
                          className="space-y-2"
                        >
                          {row.outcomeInsight ? (
                            <p className="break-anywhere text-xs text-cyan-100">{row.outcomeInsight}</p>
                          ) : null}
                          {row.safeLastError ? (
                            <p className="break-anywhere text-xs text-rose-100">
                              Last error: {row.safeLastError}
                            </p>
                          ) : null}
                          {run.correlation_id ? (
                            <p className="break-anywhere text-xs text-muted">
                              Correlation {run.correlation_id}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        )}
      </ScrollableRegion>
    </div>
  );
}

function StatusChip({
  status,
  uiStatus,
}: {
  status: string;
  uiStatus?: SyncRunUiStatus;
}) {
  const normalized = uiStatus ?? syncRunStatusLabel(status);
  if (normalized === "Partial") {
    return (
      <span className="neon-chip neon-chip-warning inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        Partial
      </span>
    );
  }
  if (normalized === "Completed") {
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
