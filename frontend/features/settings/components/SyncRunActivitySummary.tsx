"use client";

import { RefreshCw } from "lucide-react";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { Button } from "@/components/ui/button";

type SyncRunStatusCounts = {
  completed: number;
  partial: number;
  running: number;
  failed: number;
};

export function SyncRunActivitySummary({
  headingId,
  lastUpdatedAt,
  lastAttemptedAt,
  lastSuccessfulAt,
  isRefreshing,
  hasRuns,
  healthSummaryLabel,
  statusCounts,
  summaryInsight,
  onRefresh,
}: {
  headingId: string;
  lastUpdatedAt?: string;
  lastAttemptedAt?: string;
  lastSuccessfulAt?: string;
  isRefreshing: boolean;
  hasRuns: boolean;
  healthSummaryLabel: string;
  statusCounts: SyncRunStatusCounts;
  summaryInsight: string | null;
  onRefresh: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id={headingId} className="text-sm font-semibold text-white">
          Recent sync runs
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {lastUpdatedAt ? (
            <p className="text-xs font-medium text-cyan-200">
              Updated{" "}
              <RelativeTime
                value={lastUpdatedAt}
                fallback="time pending"
                exactLabel="Updated at"
              />
            </p>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isRefreshing ? "Refreshing..." : "Refresh log"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
          Last attempted{" "}
          {lastAttemptedAt ? (
            <RelativeTime
              value={lastAttemptedAt}
              fallback="time pending"
              exactLabel="Last attempted at"
            />
          ) : (
            "never"
          )}
        </span>
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
          Last successful{" "}
          {lastSuccessfulAt ? (
            <RelativeTime
              value={lastSuccessfulAt}
              fallback="time pending"
              exactLabel="Last successful at"
            />
          ) : (
            "none yet"
          )}
        </span>
      </div>
      {hasRuns ? (
        <div className="neon-surface space-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-white">{healthSummaryLabel}</p>
            <p className="text-xs text-muted">
              Completed {statusCounts.completed}, Partial {statusCounts.partial}, Running{" "}
              {statusCounts.running}, Failed {statusCounts.failed}
            </p>
          </div>
          {summaryInsight ? (
            <p className="text-xs leading-5 text-cyan-100">{summaryInsight}</p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
