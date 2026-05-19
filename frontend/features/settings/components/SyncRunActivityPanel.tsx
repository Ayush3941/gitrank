"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Search, XCircle } from "lucide-react";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { formatDateTime, formatRelativeDays } from "@/lib/formatters";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { syncRunStatusLabel } from "@/features/settings/lib/sync-run-status";

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
  const [statusFilter, setStatusFilter] = useState<"All" | "Completed" | "Running" | "Failed">("All");
  const deferredSearch = useDeferredValue(search);
  const deferredStatusFilter = useDeferredValue(statusFilter);
  const isFiltering = deferredSearch !== search || deferredStatusFilter !== statusFilter;
  const canReset = search.trim().length > 0 || statusFilter !== "All";
  const filterStatusId = "settings-sync-filter-status";
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
    const term = deferredSearch.trim().toLowerCase();
    return runs.filter((run) => {
      const normalizedStatus = syncRunStatusLabel(run.status);
      const statusMatch =
        deferredStatusFilter === "All" || normalizedStatus === deferredStatusFilter;
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
  }, [deferredSearch, deferredStatusFilter, runs]);

  function handleResetFilters() {
    startTransition(() => {
      setSearch("");
      setStatusFilter("All");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Sync activity</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Recent sync runs</h2>
          <p className="mt-2 text-sm text-muted">
            Reverse-chronological execution history for your authenticated sync requests.
          </p>
        </div>
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
            {isFiltering
              ? "Updating sync log..."
              : `${filteredRuns.length} of ${statusCounts.all} runs`}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Completed {statusCounts.completed}</span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Running {statusCounts.running}</span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Failed {statusCounts.failed}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleResetFilters}
              disabled={!canReset || isFiltering}
            >
              Reset
            </Button>
          </div>
        </div>
        {statusCounts.running > 0 ? (
          <p className="text-xs text-cyan-100">
            Active sync runs detected. This panel auto-refreshes more frequently until active jobs settle.
          </p>
        ) : null}
        {statusCounts.running === 0 && statusCounts.failed > 0 ? (
          <p className="text-xs text-rose-100">
            Recent sync failures detected. Reconnect GitHub in{" "}
            <Link href="/dashboard/settings" className="underline decoration-rose-300/70 underline-offset-2">
              account settings
            </Link>
            {" "}if failures persist.
          </p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr,22rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                startTransition(() => setSearch(value));
              }}
              className="pl-11"
              placeholder="Search run subject, mode, or error"
              aria-label="Search sync runs"
              aria-describedby={filterStatusId}
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(["All", "Completed", "Running", "Failed"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={statusFilter === item ? "default" : "secondary"}
                onClick={() => startTransition(() => setStatusFilter(item))}
                disabled={isFiltering}
                aria-describedby={filterStatusId}
              >
                {item}
              </Button>
            ))}
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
            <Button asChild type="button" size="sm" variant="ghost">
              <Link href="/dashboard/settings">Open settings</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="neon-surface grid gap-2 px-4 py-4 text-sm text-muted">
          <p>Loading recent sync activity…</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4 text-sm text-muted">
          <p>No sync runs recorded for this account yet. Open dashboard lanes and GitRank will enqueue background sync automatically.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/settings">Open settings</Link>
            </Button>
          </div>
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4 text-sm text-muted">
          <p>No sync runs match the current search or status filter.</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleResetFilters}
              disabled={isFiltering || !canReset}
            >
              Reset filters
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/settings">Open settings</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2">
          {filteredRuns.map((run) => {
            const safeLastError = sanitizeSyncRunErrorMessage(run.last_error);
            return (
              <article key={run.id} className="render-opt-card neon-surface space-y-2 px-4 py-3">
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-200/84">
                  <span>
                    Started {toFriendlyTimestamp(run.started_at)}
                  </span>
                  {run.finished_at ? <span>Duration {runDuration(run.started_at, run.finished_at)}</span> : null}
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
            );
          })}
        </div>
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
