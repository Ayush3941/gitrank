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
  Search,
  ServerCog,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const statusFilters = [
  { value: "All" },
  { value: "Merged" },
  { value: "Open" },
] as const;

const focusFilters = [
  { value: "Any" },
  { value: "Docs" },
  { value: "Tests" },
  { value: "Bug Fixes" },
  { value: "Infra" },
  { value: "Security" },
  { value: "Performance" },
  { value: "High XP" },
] as const;

const statusIconByValue = {
  All: LayoutGrid,
  Merged: GitMerge,
  Open: CircleDot,
} as const;

const focusIconByValue = {
  Any: LayoutGrid,
  Docs: BookText,
  Tests: FlaskConical,
  "Bug Fixes": Bug,
  Infra: ServerCog,
  Security: ShieldCheck,
  Performance: Gauge,
  "High XP": Trophy,
} as const;

const sortOptions = [
  "Newest",
  "Highest XP",
  "Highest Difficulty",
  "Highest Impact",
] as const;

const sortIconByValue = {
  Newest: Clock3,
  "Highest XP": Trophy,
  "Highest Difficulty": Gauge,
  "Highest Impact": BarChart3,
} as const;

export function ContributionFilters({
  value,
  onValueChange,
  search,
  onSearchChange,
  sort,
  onSortChange,
  onClearCategory,
  onClearSort,
  resultCount,
  isFiltering,
  canReset,
  onReset,
  onClearSearch,
  resultsRegionId,
  compact = false,
  statusCounts,
  focusCounts,
}: {
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact") => void;
  onClearCategory?: () => void;
  onClearSort?: () => void;
  resultCount?: number;
  isFiltering?: boolean;
  canReset?: boolean;
  onReset?: () => void;
  onClearSearch?: () => void;
  resultsRegionId?: string;
  compact?: boolean;
  statusCounts?: Partial<Record<(typeof statusFilters)[number]["value"], number>>;
  focusCounts?: Partial<Record<(typeof focusFilters)[number]["value"], number>>;
}) {
  type StatusFilterValue = (typeof statusFilters)[number]["value"];
  type FocusFilterValue = (typeof focusFilters)[number]["value"];

  const statusId = "contribution-filter-status";
  const activeChips: Array<{ key: "category" | "search" | "sort"; label: string }> = [];
  if (value !== "All") {
    activeChips.push({ key: "category", label: value });
  }
  if (search.trim().length > 0) {
    const compactSearch = search.trim().length > 28 ? `${search.trim().slice(0, 28)}…` : search.trim();
    activeChips.push({ key: "search", label: `Search: ${compactSearch}` });
  }
  if (sort !== "Newest") {
    activeChips.push({ key: "sort", label: sort });
  }

  const activeStatus: StatusFilterValue =
    value === "Merged" || value === "Open" ? value : "All";
  const activeFocus: FocusFilterValue =
    value === "Docs" ||
    value === "Tests" ||
    value === "Bug Fixes" ||
    value === "Infra" ||
    value === "Security" ||
    value === "Performance" ||
    value === "High XP"
      ? value
      : "Any";

  function handleStatusChange(nextValue: string) {
    const next = nextValue as StatusFilterValue;
    if (next === "All") {
      onValueChange(activeFocus === "Any" ? "All" : activeFocus);
      return;
    }
    onValueChange(next);
  }

  function handleFocusChange(nextValue: string) {
    const next = nextValue as FocusFilterValue;
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
      className="space-y-4"
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">Contribution controls</p>
        <p className="text-xs text-muted">
          {isFiltering ? "Updating cards..." : `${resultCount ?? 0} cards`}
        </p>
      </div>
      {activeChips.length ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ul role="list" className="flex flex-wrap gap-2 text-xs">
            {activeChips.map((chip) => {
              const handleRemove =
                chip.key === "category"
                  ? onClearCategory
                  : chip.key === "search"
                    ? onClearSearch
                    : onClearSort;
              return (
                <li key={chip.key} className="list-none">
                  {handleRemove ? (
                    <button
                      type="button"
                      className="focus-ring neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold"
                      onClick={handleRemove}
                      disabled={isFiltering}
                      aria-label={`Remove ${chip.label} filter`}
                      aria-controls={resultsRegionId}
                    >
                      {chip.label}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold">
                      {chip.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {onReset ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onReset}
              disabled={!canReset || isFiltering}
              aria-controls={resultsRegionId}
            >
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}
      <div id="contribution-mobile-controls">
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">Status lane</p>
          <SegmentedTablist
            options={statusFilters.map((filter) => {
              const Icon = statusIconByValue[filter.value];
              return {
                value: filter.value,
                label: filter.value,
                icon: <Icon className="h-4 w-4" />,
                count: statusCounts?.[filter.value],
                minWidthClassName: "min-w-[7.5rem]",
              };
            })}
            value={activeStatus}
            onValueChange={handleStatusChange}
            ariaLabel="Contribution status filters"
            ariaControls={resultsRegionId}
            tabIdPrefix="contribution-status-tab"
            wrap={false}
          />
        </div>
        <div className="grid gap-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Focus lane</p>
            <SegmentedTablist
              options={focusFilters.map((filter) => {
                const Icon = focusIconByValue[filter.value];
                return {
                  value: filter.value,
                  label: filter.value,
                  icon: <Icon className="h-4 w-4" />,
                  count: focusCounts?.[filter.value],
                  minWidthClassName: "min-w-[8rem]",
                };
              })}
              value={activeFocus}
              onValueChange={handleFocusChange}
              ariaLabel="Contribution focus filters"
              ariaControls={resultsRegionId}
              tabIdPrefix="contribution-focus-tab"
              wrap={false}
            />
            <p className="text-xs text-muted">
              Status lanes track PR state. Focus lanes track topic and impact patterns.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-11 pr-11"
              placeholder="Search repo, PR title, or owner"
              aria-label="Search contributions"
              aria-describedby={statusId}
            />
            {search.trim().length > 0 ? (
              <button
                type="button"
                onClick={onClearSearch}
                disabled={isFiltering}
                className="focus-ring absolute top-1/2 right-3 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-cyan-100 hover:text-white disabled:opacity-60"
                aria-label="Clear contribution search"
                aria-controls={resultsRegionId}
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Sort order</p>
            <SegmentedTablist
              options={sortOptions.map((item) => {
                const Icon = sortIconByValue[item];
                return {
                  value: item,
                  label: item,
                  icon: <Icon className="h-4 w-4" />,
                  minWidthClassName: "min-w-[9rem]",
                };
              })}
              value={sort}
              onValueChange={(next) =>
                onSortChange(next as "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact")
              }
              ariaLabel="Contribution sort options"
              ariaDescribedBy={statusId}
              ariaControls={resultsRegionId}
              tabIdPrefix="contribution-sort-tab"
              wrap={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
