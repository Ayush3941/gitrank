"use client";

import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { formatRelativeDays } from "@/lib/formatters";

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
              Updated {formatRelativeDays(lastUpdatedAt)}
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

      {isError ? (
        <div role="alert" className="neon-surface border-rose-300/28 px-4 py-3 text-sm text-rose-100">
          {errorMessage || "Sync activity is temporarily unavailable."}
        </div>
      ) : null}

      {isLoading ? (
        <div className="neon-surface grid gap-2 px-4 py-4 text-sm text-muted">
          <p>Loading recent sync activity…</p>
        </div>
      ) : runs.length === 0 ? (
        <div className="neon-surface border-dashed border-primary/24 px-4 py-4 text-sm text-muted">
          No sync runs recorded for this account yet. Open dashboard lanes and GitRank will enqueue background sync automatically.
        </div>
      ) : (
        <div className="grid gap-2">
          {runs.map((run) => (
            <article key={run.id} className="neon-surface space-y-2 px-4 py-3">
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
              {run.last_error ? (
                <p className="break-anywhere text-xs text-rose-100">
                  Last error: {run.last_error}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "completed") {
    return (
      <span className="neon-chip neon-chip-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Completed
      </span>
    );
  }
  if (normalized === "failed") {
    return (
      <span className="neon-chip inline-flex items-center gap-1.5 rounded-full border-rose-300/30 bg-rose-500/12 px-2.5 py-1 text-xs font-semibold text-rose-100">
        <XCircle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }
  if (normalized === "running" || normalized === "syncing") {
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
