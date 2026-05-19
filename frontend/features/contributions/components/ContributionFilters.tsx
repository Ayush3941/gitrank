"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  resultCount,
  isFiltering,
  canReset,
  onReset,
  onClearCategory,
  onClearSearch,
  onClearSort,
}: {
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact") => void;
  resultCount?: number;
  isFiltering?: boolean;
  canReset?: boolean;
  onReset?: () => void;
  onClearCategory?: () => void;
  onClearSearch?: () => void;
  onClearSort?: () => void;
}) {
  const statusId = "contribution-filter-status";
  const activeChips: Array<{
    key: "category" | "search" | "sort";
    label: string;
    onRemove?: () => void;
  }> = [];
  if (value !== "All") {
    activeChips.push({
      key: "category",
      label: `Category: ${value}`,
      onRemove: onClearCategory,
    });
  }
  if (search.trim().length > 0) {
    const compactSearch = search.trim().length > 28 ? `${search.trim().slice(0, 28)}…` : search.trim();
    activeChips.push({
      key: "search",
      label: `Search: ${compactSearch}`,
      onRemove: onClearSearch,
    });
  }
  if (sort !== "Newest") {
    activeChips.push({
      key: "sort",
      label: `Sort: ${sort}`,
      onRemove: onClearSort,
    });
  }

  return (
    <section aria-labelledby="contribution-filter-controls-label" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="contribution-filter-controls-label" className="text-sm font-medium text-cyan-100">
          Filter controls
        </p>
        <p id={statusId} role="status" aria-live="polite" className="text-sm text-cyan-100">
          {isFiltering
            ? "Updating contribution list..."
            : `Showing ${resultCount ?? 0} contribution cards`}
        </p>
        {onReset ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onReset}
            disabled={!canReset || isFiltering}
          >
            Reset filters
          </Button>
        ) : null}
      </div>
      {activeChips.length ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {activeChips.map((chip) => (
            <span key={chip.key} className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold">
              {chip.label}
              {chip.onRemove ? (
                <button
                  type="button"
                  onClick={chip.onRemove}
                  disabled={isFiltering}
                  className="focus-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-primary/30 px-1 text-[11px] leading-none text-cyan-100 hover:bg-primary/14 disabled:opacity-60"
                  aria-label={`Remove ${chip.key} filter`}
                  title={`Remove ${chip.key} filter`}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
            No active filters
          </span>
        </div>
      )}
      <Tabs value={value} onValueChange={onValueChange}>
        <TabsList className="scrollbar-thin w-full overflow-x-auto whitespace-nowrap" aria-label="Contribution category filters">
          {filters.map((filter) => (
            <TabsTrigger
              key={filter.value}
              value={filter.value}
              title={filter.value}
              aria-label={`${filter.value} contributions`}
            >
              <span className="sm:hidden">{filter.short}</span>
              <span className="hidden sm:inline">{filter.value}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-3 lg:grid-cols-[1fr,16rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="pl-11"
            placeholder="Search repo, PR title, or owner"
            aria-label="Search contributions"
            aria-describedby={statusId}
          />
        </div>
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger aria-label="Sort contributions" aria-describedby={statusId}>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Newest">Newest</SelectItem>
            <SelectItem value="Highest XP">Highest XP</SelectItem>
            <SelectItem value="Highest Difficulty">Highest Difficulty</SelectItem>
            <SelectItem value="Highest Impact">Highest Impact</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </section>
  );
}
