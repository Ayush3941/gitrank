"use client";

import { AlertTriangle, CheckCircle2, Clock3, XCircle } from "lucide-react";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExactTime } from "@/components/shared/ExactTime";
import { LoadingState } from "@/components/shared/LoadingState";
import { ScrollableRegion } from "@/components/shared/ScrollableRegion";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import {
  syncRunStatusLabel,
  type SyncRunUiStatus,
} from "@/features/settings/lib/sync-run-status";

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

const RESULTS_REGION_CLASS_NAME = "min-h-[12rem]";

export function SyncRunActivityResults({
  resultsRegionId,
  headingId,
  isLoading,
  isRefreshing,
  runsCount,
  rows,
  detailsExpandedByRunID,
  onToggleRunDetails,
  onResetFilters,
}: {
  resultsRegionId: string;
  headingId: string;
  isLoading: boolean;
  isRefreshing: boolean;
  runsCount: number;
  rows: SyncRunActivityRow[];
  detailsExpandedByRunID: Record<string, boolean>;
  onToggleRunDetails: (runID: string) => void;
  onResetFilters: () => void;
}) {
  return (
    <ScrollableRegion
      id={resultsRegionId}
      labelledById={headingId}
      aria-busy={isLoading || isRefreshing}
      className="sync-runs-results-viewport overflow-y-auto pr-1"
    >
      {isLoading ? (
        <div className={RESULTS_REGION_CLASS_NAME}>
          <LoadingState message="Recent sync activity" />
        </div>
      ) : runsCount === 0 ? (
        <div className={RESULTS_REGION_CLASS_NAME}>
          <EmptyState
            eyebrow="Sync activity"
            title="No sync runs yet."
            description="Open dashboard to start auto-sync and populate recent activity."
            actionLabel="Open dashboard"
            actionHref="/dashboard"
          />
        </div>
      ) : rows.length === 0 ? (
        <div className={RESULTS_REGION_CLASS_NAME}>
          <EmptyState
            eyebrow="Filter results"
            title="No sync runs match this filter."
            description="Reset filters to inspect all recent sync attempts."
            actionLabel="Reset filters"
            onAction={onResetFilters}
          />
        </div>
      ) : (
        <ol role="list" className={`grid gap-2 ${RESULTS_REGION_CLASS_NAME}`}>
          {rows.map((row) => (
            <SyncRunActivityResultRow
              key={row.id}
              row={row}
              resultsRegionId={resultsRegionId}
              detailsExpanded={resolveDetailsExpanded(row, detailsExpandedByRunID)}
              onToggleRunDetails={onToggleRunDetails}
            />
          ))}
        </ol>
      )}
    </ScrollableRegion>
  );
}

function SyncRunActivityResultRow({
  row,
  resultsRegionId,
  detailsExpanded,
  onToggleRunDetails,
}: {
  row: SyncRunActivityRow;
  resultsRegionId: string;
  detailsExpanded: boolean;
  onToggleRunDetails: (runID: string) => void;
}) {
  const run = row.run;
  const detailsAvailable = Boolean(
    row.outcomeInsight || row.safeLastError || run.correlation_id,
  );
  const detailsRegionID = `${resultsRegionId}-${row.id}-details`;
  const detailsButtonID = `${resultsRegionId}-${row.id}-details-button`;

  return (
    <li>
      <article className="render-opt-card neon-surface space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="break-anywhere text-sm font-semibold text-white">
              {row.label}
            </p>
            <p className="mt-1 break-anywhere text-xs text-muted">
              {run.subject || "No subject"}, {run.run_type}
            </p>
          </div>
          <StatusChip status={run.status} uiStatus={row.uiStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            Started <ExactTime value={run.started_at} />
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
                onToggleRunDetails(row.id);
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
}

function resolveDetailsExpanded(
  row: SyncRunActivityRow,
  detailsExpandedByRunID: Record<string, boolean>,
): boolean {
  const detailsAvailable = Boolean(
    row.outcomeInsight || row.safeLastError || row.run.correlation_id,
  );
  if (!detailsAvailable) {
    return false;
  }
  const defaultDetailsExpanded = row.uiStatus === "Failed" || row.uiStatus === "Partial";
  return detailsExpandedByRunID[row.id] ?? defaultDetailsExpanded;
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
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        Partial
      </span>
    );
  }
  if (normalized === "Completed") {
    return (
      <span className="neon-chip neon-chip-success inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        Completed
      </span>
    );
  }
  if (normalized === "Failed") {
    return (
      <span className="neon-chip inline-flex items-center gap-1.5 rounded-full border-rose-300/30 bg-rose-500/12 px-2.5 py-1 text-xs font-semibold text-rose-100">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Failed
      </span>
    );
  }
  if (normalized === "Queued") {
    return (
      <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Queued
      </span>
    );
  }
  if (normalized === "Running") {
    return (
      <span className="neon-chip neon-chip-info inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
        Running
      </span>
    );
  }
  return (
    <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold">
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      {status || "Unknown"}
    </span>
  );
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
