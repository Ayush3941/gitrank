"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { formatDateTime, formatRelativeDays } from "@/lib/formatters";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { syncRunStatusLabel } from "@/features/settings/lib/sync-run-status";

const SYNC_RUN_STATUS_FILTERS = ["All", "Completed", "Running", "Failed"] as const;
type SyncRunStatusFilter = (typeof SYNC_RUN_STATUS_FILTERS)[number];

export function SyncRunActivityPanel({
  runs,
  lastUpdatedAt,
  isLoading,
  isRefreshing,
  isError,
  errorMessage,
  onRefresh,
}: {
  runs: ApiSyncRunRecord[];
  lastUpdatedAt?: string;
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
      running: 0,
      failed: 0,
    };
    for (const run of runs) {
      const status = syncRunStatusLabel(run.status);
      if (status === "Completed") {
        next.completed += 1;
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
    <div className="space-y-4">
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
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={filterStatusId} role="status" aria-live="polite" className="text-xs font-medium text-cyan-200">
            {`${filteredRuns.length} of ${statusCounts.all} runs`}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleResetFilters}
            disabled={!canReset}
            aria-controls={syncRunsRegionId}
          >
            Reset
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr,22rem]">
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
                className="focus-ring absolute top-1/2 right-3 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-cyan-100 hover:text-white"
                aria-label="Clear sync run search"
                aria-controls={syncRunsRegionId}
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div
            aria-describedby={filterStatusId}
            className="neon-surface flex flex-col gap-2 rounded-[1rem] px-3 py-2"
          >
            <label
              htmlFor="sync-run-status-filter"
              className="text-xs font-medium text-primary"
            >
              Status filter
            </label>
            <select
              id="sync-run-status-filter"
              value={statusFilter}
              className="focus-ring h-10 w-full rounded-[0.1rem] border border-primary/24 bg-card px-3 text-sm text-foreground"
              onChange={(event) => {
                setStatusFilter(event.target.value as SyncRunStatusFilter);
              }}
            >
              {SYNC_RUN_STATUS_FILTERS.map((status) => {
                const count =
                  status === "All"
                    ? statusCounts.all
                    : status === "Completed"
                      ? statusCounts.completed
                      : status === "Running"
                        ? statusCounts.running
                        : statusCounts.failed;
                return (
                  <option key={status} value={status} className="bg-card text-foreground">
                    {status} ({count})
                  </option>
                );
              })}
            </select>
          </div>
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

      {isLoading ? (
        <div
          id={syncRunsRegionId}
          className={`neon-surface grid gap-2 px-4 py-4 text-sm text-muted ${resultsRegionClassName}`}
        >
          <p>Loading recent sync activity…</p>
        </div>
      ) : runs.length === 0 ? (
        <div
          id={syncRunsRegionId}
          className={`neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4 text-sm text-muted ${resultsRegionClassName}`}
        >
          <p>No sync runs recorded for this account yet. Open dashboard and GitRank will enqueue background sync automatically.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div
          id={syncRunsRegionId}
          className={`neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4 text-sm text-muted ${resultsRegionClassName}`}
        >
          <p>No sync runs match the current search or status filter.</p>
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
        <ol
          id={syncRunsRegionId}
          role="list"
          className={`grid gap-2 ${resultsRegionClassName}`}
        >
          {filteredRuns.map((run) => {
            const safeLastError = sanitizeSyncRunErrorMessage(run.last_error);
            return (
              <li key={run.id}>
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
                    <StatusChip status={run.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span>
                      Started {toFriendlyTimestamp(run.started_at)}
                    </span>
                    {run.finished_at ? (
                      <span>Duration {runDuration(run.started_at, run.finished_at)}</span>
                    ) : null}
                    {run.correlation_id ? (
                      <span className="break-anywhere">Correlation {run.correlation_id}</span>
                    ) : null}
                  </div>
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
  );
}

function StatusChip({ status }: { status: string }) {
  const normalized = syncRunStatusLabel(status);
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
    return "time unavailable";
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
  return sanitizeUserFacingError(value, "settings-sync-runs");
}
