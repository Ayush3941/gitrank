"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

const filters = [
  { value: "All", short: "All" },
  { value: "Merged", short: "Merged" },
  { value: "Open", short: "Open" },
  { value: "Docs", short: "Docs" },
  { value: "Tests", short: "Tests" },
  { value: "Bug Fixes", short: "Bugs" },
  { value: "Infra", short: "Infra" },
  { value: "Security", short: "Security" },
  { value: "Performance", short: "Perf" },
  { value: "High XP", short: "High XP" },
] as const;

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
}) {
  const statusId = "contribution-filter-status";
  const activeChips: Array<{ key: "category" | "search" | "sort"; label: string }> = [];
  if (value !== "All") {
    activeChips.push({ key: "category", label: `Category: ${value}` });
  }
  if (search.trim().length > 0) {
    const compactSearch = search.trim().length > 28 ? `${search.trim().slice(0, 28)}…` : search.trim();
    activeChips.push({ key: "search", label: `Search: ${compactSearch}` });
  }
  if (sort !== "Newest") {
    activeChips.push({ key: "sort", label: `Sort: ${sort}` });
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
        <div className="sm:hidden">
          <label className="neon-surface flex h-11 items-center rounded-[0.1rem] border border-primary/28 px-3">
            <span className="sr-only">Contribution category filter</span>
            <select
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              aria-label="Contribution category filter"
              aria-describedby={statusId}
              aria-controls={resultsRegionId}
              className="focus-ring h-full w-full bg-transparent text-sm text-foreground outline-none"
            >
              {filters.map((filter) => (
                <option key={filter.value} value={filter.value} className="bg-card text-foreground">
                  {filter.value}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="hidden sm:block">
          <ul
            role="list"
            aria-label="Contribution category filters"
            className="grid gap-1.5 sm:grid-cols-3 xl:grid-cols-5"
          >
            {filters.map((filter) => {
              const active = value === filter.value;
              return (
                <li key={filter.value} className="list-none">
                  <button
                    type="button"
                    title={filter.value}
                    aria-label={`${filter.value} contributions`}
                    aria-controls={resultsRegionId}
                    aria-pressed={active}
                    data-active={active ? "true" : "false"}
                    className={cn(
                      "focus-ring dashboard-nav-item w-full px-3 py-2 text-center text-sm font-semibold",
                      active ? "text-white" : "text-muted",
                    )}
                    onClick={() => {
                      onValueChange(filter.value);
                    }}
                  >
                    <span className="xl:hidden">{filter.short}</span>
                    <span className="hidden xl:inline">{filter.value}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr,16rem]">
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
          <label className="neon-surface flex h-11 items-center rounded-[0.1rem] border border-primary/28 px-3">
            <span className="sr-only">Sort contributions</span>
            <select
              value={sort}
              onChange={(event) =>
                onSortChange(event.target.value as "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact")
              }
              aria-label="Sort contributions"
              aria-describedby={statusId}
              aria-controls={resultsRegionId}
              className="focus-ring h-full w-full bg-transparent text-sm text-foreground outline-none"
            >
              <option value="Newest" className="bg-card text-foreground">Newest</option>
              <option value="Highest XP" className="bg-card text-foreground">Highest XP</option>
              <option value="Highest Difficulty" className="bg-card text-foreground">Highest Difficulty</option>
              <option value="Highest Impact" className="bg-card text-foreground">Highest Impact</option>
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}
