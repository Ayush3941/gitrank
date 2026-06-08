"use client";

import { ControlSurface } from "@/components/shared/ControlSurface";
import { SearchInputWithClear } from "@/components/shared/SearchInputWithClear";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  SYNC_RUN_STATUS_FILTERS,
  type SyncRunStatusCounts,
  type SyncRunStatusFilter,
} from "@/features/settings/lib/sync-run-activity-model";

const SYNC_RUN_STATUS_META: Record<SyncRunStatusFilter, { countKey: keyof SyncRunStatusCounts }> = {
  All: { countKey: "all" },
  Completed: { countKey: "completed" },
  Partial: { countKey: "partial" },
  Queued: { countKey: "queued" },
  Running: { countKey: "running" },
  Failed: { countKey: "failed" },
};

export function SyncRunActivityFilters({
  search,
  statusFilter,
  statusCounts,
  filteredCount,
  canReset,
  filterStatusId,
  resultsRegionId,
  onSearchChange,
  onSearchClear,
  onStatusFilterChange,
  onResetFilters,
}: {
  search: string;
  statusFilter: SyncRunStatusFilter;
  statusCounts: SyncRunStatusCounts;
  filteredCount: number;
  canReset: boolean;
  filterStatusId: string;
  resultsRegionId: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onStatusFilterChange: (value: SyncRunStatusFilter) => void;
  onResetFilters: () => void;
}) {
  return (
    <ControlSurface as="section">
      <p id={filterStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {`${filteredCount} of ${statusCounts.all} runs`}
      </p>
      <div className="space-y-3">
        <SearchInputWithClear
          value={search}
          onChange={onSearchChange}
          onClear={onSearchClear}
          placeholder="Search run subject, mode, or error"
          ariaLabel="Search sync runs"
          ariaDescribedBy={filterStatusId}
          ariaControls={resultsRegionId}
          clearButtonLabel="Clear sync run search"
          inputClassName="pl-11 pr-11"
        />
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">Run status</p>
          <SegmentedControl
            options={SYNC_RUN_STATUS_FILTERS.map((status) => {
              const meta = SYNC_RUN_STATUS_META[status];
              return {
                value: status,
                label: status,
                count: statusCounts[meta.countKey],
                minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
              };
            })}
            value={statusFilter}
            onValueChange={onStatusFilterChange}
            ariaLabel="Sync run status filter"
            ariaDescribedBy={filterStatusId}
            ariaControls={resultsRegionId}
            controlIdPrefix="sync-run-status-filter"
            wrap
          />
        </div>
        {canReset ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onResetFilters}
              aria-controls={resultsRegionId}
              className="px-3"
            >
              Reset filters
            </Button>
          </div>
        ) : null}
      </div>
    </ControlSurface>
  );
}
