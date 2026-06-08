"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import {
  SyncRunActivityFilters,
} from "@/features/settings/components/SyncRunActivityFilters";
import { SyncRunActivityResults } from "@/features/settings/components/SyncRunActivityResults";
import { SyncRunActivitySummary } from "@/features/settings/components/SyncRunActivitySummary";
import {
  buildSyncRunActivityModel,
  type SyncRunStatusFilter,
} from "@/features/settings/lib/sync-run-activity-model";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";

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
  const deferredSearch = useDeferredValue(search);
  const filterStatusId = useId();
  const syncRunsHeadingId = useId();
  const syncRunsRegionId = useId();
  const syncRunActivity = useMemo(
    () =>
      buildSyncRunActivityModel({
        runs,
        search,
        deferredSearch,
        statusFilter,
      }),
    [deferredSearch, runs, search, statusFilter],
  );

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
        healthSummaryLabel={syncRunActivity.healthSummaryLabel}
        statusCounts={syncRunActivity.statusCounts}
        summaryInsight={syncRunActivity.summaryInsight}
        onRefresh={onRefresh}
      />
      <SyncRunActivityFilters
        search={search}
        statusFilter={statusFilter}
        statusCounts={syncRunActivity.statusCounts}
        filteredCount={syncRunActivity.filteredRows.length}
        canReset={syncRunActivity.canReset}
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
        rows={syncRunActivity.filteredRows}
        detailsExpandedByRunID={detailsExpandedByRunID}
        onToggleRunDetails={toggleRunDetails}
        onResetFilters={handleResetFilters}
      />
    </div>
  );
}
