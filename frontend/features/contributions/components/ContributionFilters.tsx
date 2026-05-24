"use client";

import {
  BookText,
  Bug,
  CircleDot,
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

const filters = [
  { value: "All" },
  { value: "Merged" },
  { value: "Open" },
  { value: "Docs" },
  { value: "Tests" },
  { value: "Bug Fixes" },
  { value: "Infra" },
  { value: "Security" },
  { value: "Performance" },
  { value: "High XP" },
] as const;

const filterIconByValue = {
  All: LayoutGrid,
  Merged: GitMerge,
  Open: CircleDot,
  Docs: BookText,
  Tests: FlaskConical,
  "Bug Fixes": Bug,
  Infra: ServerCog,
  Security: ShieldCheck,
  Performance: Gauge,
  "High XP": Trophy,
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
        <SegmentedTablist
          options={filters.map((filter) => {
            const Icon = filterIconByValue[filter.value];
            return {
              value: filter.value,
              label: filter.value,
              icon: <Icon className="h-4 w-4" />,
              minWidthClassName: "min-w-[8.5rem]",
            };
          })}
          value={value}
          onValueChange={onValueChange}
          ariaLabel="Contribution category filters"
          ariaControls={resultsRegionId}
          tabIdPrefix="contribution-filter-tab"
        />
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
