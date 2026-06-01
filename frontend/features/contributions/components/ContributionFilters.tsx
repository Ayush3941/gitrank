"use client";

import {
  BarChart3,
  BookText,
  Bug,
  CircleDot,
  Clock3,
  FlaskConical,
  Gauge,
  GitMerge,
  LayoutGrid,
  ServerCog,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { SearchInputWithClear } from "@/components/shared/SearchInputWithClear";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
import {
  contributionFocusFilters,
  CONTRIBUTION_DEFAULT_FILTER,
  CONTRIBUTION_DEFAULT_SORT,
  contributionSortOptions,
  contributionStatusFilters,
  isContributionSortOption,
  resolveContributionFocusFilter,
  resolveContributionStatusFilter,
  type ContributionFilterValue,
  type ContributionFocusFilter,
  type ContributionSortOption,
  type ContributionStatusFilter,
} from "@/lib/runtime/contribution-filter-policy";

const statusIconByValue: Record<ContributionStatusFilter, typeof LayoutGrid> = {
  All: LayoutGrid,
  Merged: GitMerge,
  Open: CircleDot,
};

const focusIconByValue: Record<ContributionFocusFilter, typeof LayoutGrid> = {
  Any: LayoutGrid,
  Docs: BookText,
  Tests: FlaskConical,
  "Bug Fixes": Bug,
  Infra: ServerCog,
  Security: ShieldCheck,
  Performance: Gauge,
  "High XP": Trophy,
};

const focusCompactLabelByValue: Record<ContributionFocusFilter, string> = {
  Any: "Any",
  Docs: "Docs",
  Tests: "Tests",
  "Bug Fixes": "Bugfix",
  Infra: "Infra",
  Security: "Security",
  Performance: "Perf",
  "High XP": "High XP",
};

const sortIconByValue: Record<ContributionSortOption, typeof Clock3> = {
  Newest: Clock3,
  "Highest XP": Trophy,
  "Highest Difficulty": Gauge,
  "Highest Impact": BarChart3,
};

const sortCompactLabelByValue: Record<ContributionSortOption, string> = {
  Newest: "Newest",
  "Highest XP": "Top XP",
  "Highest Difficulty": "Top Diff",
  "Highest Impact": "Top Impact",
};

export function ContributionFilters({
  value,
  onValueChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  resultCount,
  isFiltering,
  canReset,
  onReset,
  onClearSearch,
  resultsRegionId,
  compact = false,
  statusCounts,
  focusCounts,
  contextNote,
}: {
  value: ContributionFilterValue;
  onValueChange: (value: ContributionFilterValue) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: ContributionSortOption;
  onSortChange: (value: ContributionSortOption) => void;
  resultCount?: number;
  isFiltering?: boolean;
  canReset?: boolean;
  onReset?: () => void;
  onClearSearch?: () => void;
  resultsRegionId?: string;
  compact?: boolean;
  statusCounts?: Partial<Record<ContributionStatusFilter, number>>;
  focusCounts?: Partial<Record<ContributionFocusFilter, number>>;
  contextNote?: string;
}) {
  const statusId = "contribution-filter-status";
  const activeStatus = resolveContributionStatusFilter(value);
  const activeFocus = resolveContributionFocusFilter(value);

  const activeViewLabel =
    activeStatus !== "All" ? activeStatus : activeFocus !== "Any" ? activeFocus : "All";
  const activeFilterCount =
    (value !== CONTRIBUTION_DEFAULT_FILTER ? 1 : 0) +
    (search.trim().length > 0 ? 1 : 0) +
    (sort !== CONTRIBUTION_DEFAULT_SORT ? 1 : 0);
  const trimmedSearch = search.trim();
  const compactSearch = trimmedSearch.length > 28 ? `${trimmedSearch.slice(0, 28)}…` : trimmedSearch;

  function handleClearSearch() {
    if (onClearSearch) {
      onClearSearch();
      return;
    }
    onSearchChange("");
  }

  function handleStatusChange(nextValue: string) {
    const next = nextValue as ContributionStatusFilter;
    if (next === "All") {
      onValueChange(activeFocus === "Any" ? "All" : activeFocus);
      return;
    }
    onValueChange(next);
  }

  function handleFocusChange(nextValue: string) {
    const next = nextValue as ContributionFocusFilter;
    if (next === "Any") {
      onValueChange(activeStatus);
      return;
    }
    onValueChange(next);
  }

  return (
    <section
      aria-label="Contribution filters"
      data-compact={compact ? "true" : "false"}
      className="neon-surface space-y-4 rounded-[1rem] px-3 py-3 sm:px-4 sm:py-4"
    >
      <p
        id={statusId}
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isFiltering
          ? "Updating..."
          : `${resultCount ?? 0} cards`}
      </p>
      <FilterControlsHeader
        label="Contribution controls"
        summary={isFiltering ? "Updating cards..." : `${resultCount ?? 0} cards`}
        activeFilterCount={activeFilterCount}
        activeCountLabel={activeFilterCount > 0 ? `Active filters: ${activeFilterCount}` : undefined}
        secondaryLabel={activeFilterCount > 0 ? `Lane: ${activeViewLabel}` : undefined}
        extraControls={
          trimmedSearch.length > 0 ? (
            <button
              type="button"
              className="focus-ring neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
              onClick={handleClearSearch}
              disabled={isFiltering}
              aria-label={`Remove Search · ${compactSearch} filter`}
              aria-controls={resultsRegionId}
            >
              Search: {compactSearch}
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null
        }
        resetAction={
          onReset
            ? {
                onReset,
                enabled: true,
                disabled: !canReset || isFiltering,
                ariaControls: resultsRegionId,
              }
            : undefined
        }
      />
      <div id="contribution-mobile-controls">
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">Status</p>
          <SegmentedTablist
            options={contributionStatusFilters.map((filter) => {
              const Icon = statusIconByValue[filter];
                return {
                  value: filter,
                  label: filter,
                  icon: <Icon className="h-4 w-4" />,
                  count: statusCounts?.[filter],
                  minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
                };
              })}
              value={activeStatus}
              onValueChange={handleStatusChange}
              ariaLabel="Contribution status filters"
              ariaControls={resultsRegionId}
              tabIdPrefix="contribution-status-tab"
              wrap
            />
          </div>
        <div className="grid gap-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Category</p>
            <SegmentedTablist
              options={contributionFocusFilters.map((filter) => {
                const Icon = focusIconByValue[filter];
                return {
                  value: filter,
                  label: filter,
                  compactLabel: focusCompactLabelByValue[filter],
                  icon: <Icon className="h-4 w-4" />,
                  count: focusCounts?.[filter],
                  minWidthClassName: "min-w-[7.25rem] sm:min-w-[8rem]",
                };
              })}
              value={activeFocus}
              onValueChange={handleFocusChange}
              ariaLabel="Contribution focus filters"
              ariaControls={resultsRegionId}
              tabIdPrefix="contribution-focus-tab"
              wrap
            />
            <p className="text-xs text-muted">Status filters PR lifecycle. Category filters contribution type.</p>
          </div>
          <SearchInputWithClear
            value={search}
            onChange={onSearchChange}
            onClear={handleClearSearch}
            placeholder="Search repo, PR title, or owner"
            ariaLabel="Search contributions"
            ariaDescribedBy={statusId}
            ariaControls={resultsRegionId}
            clearButtonLabel="Clear contribution search"
            clearButtonDisabled={isFiltering}
            inputClassName="pl-11 pr-11"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Sort order</p>
            <SegmentedTablist
              options={contributionSortOptions.map((item) => {
                const Icon = sortIconByValue[item];
                return {
                  value: item,
                  label: item,
                  compactLabel: sortCompactLabelByValue[item],
                  icon: <Icon className="h-4 w-4" />,
                  minWidthClassName: "min-w-[7.5rem] sm:min-w-[9rem]",
                };
              })}
              value={sort}
              onValueChange={(next) => {
                if (!isContributionSortOption(next)) {
                  return;
                }
                onSortChange(next);
              }}
              ariaLabel="Contribution sort options"
              ariaDescribedBy={statusId}
              ariaControls={resultsRegionId}
              tabIdPrefix="contribution-sort-tab"
              wrap
            />
          </div>
          {contextNote ? <p className="text-xs text-muted">{contextNote}</p> : null}
        </div>
      </div>
    </section>
  );
}
