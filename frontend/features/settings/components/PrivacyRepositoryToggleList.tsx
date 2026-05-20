"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { RepositoryVisibility } from "@/types/gitrank";

export function PrivacyRepositoryToggleList({
  repositories,
  onToggle,
  pendingRepository,
}: {
  repositories: RepositoryVisibility[];
  onToggle?: (repository: RepositoryVisibility, checked: boolean) => void;
  pendingRepository?: string | null;
}) {
  const [items, setItems] = useState(repositories);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"All" | "Public" | "Hidden">("All");
  const deferredSearch = useDeferredValue(search);
  const deferredFilter = useDeferredValue(visibilityFilter);
  const controlled = typeof onToggle === "function";
  const visibleItems = controlled ? repositories : items;
  const isFiltering = deferredSearch !== search || deferredFilter !== visibilityFilter;
  const canReset = search.trim().length > 0 || visibilityFilter !== "All";
  const compactSearch =
    search.trim().length > 32 ? `${search.trim().slice(0, 32)}…` : search.trim();
  const statusId = "settings-repositories-filter-status";
  const visibilityGroupId = "settings-repositories-visibility-group";
  const repositoriesRegionId = "settings-repositories-visibility-region";
  const counts = useMemo(() => {
    const publicCount = visibleItems.filter((repo) => repo.visibility === "Public").length;
    return {
      total: visibleItems.length,
      public: publicCount,
      hidden: visibleItems.length - publicCount,
    };
  }, [visibleItems]);
  const filteredItems = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();

    return visibleItems.filter((repo) => {
      const visibilityMatch =
        deferredFilter === "All" || repo.visibility === deferredFilter;
      const searchMatch =
        term.length === 0 ||
        repo.name.toLowerCase().includes(term) ||
        repo.reason.toLowerCase().includes(term);
      return visibilityMatch && searchMatch;
    });
  }, [deferredFilter, deferredSearch, visibleItems]);

  function handleReset() {
    startTransition(() => {
      setSearch("");
      setVisibilityFilter("All");
    });
  }

  function handleClearSearch() {
    startTransition(() => {
      setSearch("");
    });
  }

  function handleClearVisibilityFilter() {
    startTransition(() => {
      setVisibilityFilter("All");
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={statusId} role="status" aria-live="polite" className="text-xs font-medium text-cyan-200">
            {isFiltering
              ? "Updating repository list..."
              : `${filteredItems.length} of ${counts.total} repositories`}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Public {counts.public}</span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Hidden {counts.hidden}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={!canReset || isFiltering}
              aria-controls={repositoriesRegionId}
            >
              Reset
            </Button>
          </div>
        </div>
        {canReset ? (
          <div className="flex flex-wrap items-center gap-2">
            {search.trim().length > 0 ? (
              <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs">
                Query: {compactSearch}
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="focus-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-primary/30 px-1 text-xs leading-none text-cyan-100 hover:bg-primary/14"
                  aria-label="Clear repository search query"
                  aria-controls={repositoriesRegionId}
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            {visibilityFilter !== "All" ? (
              <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs">
                State: {visibilityFilter}
                <button
                  type="button"
                  onClick={handleClearVisibilityFilter}
                  className="focus-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-primary/30 px-1 text-xs leading-none text-cyan-100 hover:bg-primary/14"
                  aria-label="Clear repository visibility filter"
                  aria-controls={repositoriesRegionId}
                  title="Clear visibility filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[1fr,15rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                startTransition(() => setSearch(value));
              }}
              className="pl-11 pr-11"
              placeholder="Search repository or reason"
              aria-label="Search repositories"
              aria-describedby={statusId}
            />
            {search.trim().length > 0 ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="focus-ring absolute top-1/2 right-3 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-cyan-100 hover:text-white"
                aria-label="Clear repository search"
                aria-controls={repositoriesRegionId}
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <span id={visibilityGroupId} className="sr-only">
            Repository visibility filter
          </span>
          <ul role="list" aria-labelledby={visibilityGroupId} className="grid grid-cols-3 gap-2">
            {(["All", "Public", "Hidden"] as const).map((item) => (
              <li key={item} className="list-none">
                <Button
                  type="button"
                  size="sm"
                  variant={visibilityFilter === item ? "default" : "secondary"}
                  onClick={() => startTransition(() => setVisibilityFilter(item))}
                  disabled={isFiltering}
                  aria-describedby={statusId}
                  aria-pressed={visibilityFilter === item}
                  aria-controls={repositoriesRegionId}
                >
                  {item}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {filteredItems.length > 0 ? (
        <ul id={repositoriesRegionId} role="list" className="grid gap-3">
          {filteredItems.map((repo) => (
            <li key={repo.name} className="list-none">
              <div className="render-opt-card neon-surface flex flex-col gap-3 rounded-[1.75rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-white">{repo.name}</p>
                  <p className="text-sm text-muted">{repo.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                      {repo.visibility}
                    </span>
                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                      {repo.tracked ? "Tracked" : "Untracked"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">{repo.visibility}</span>
                  <Switch
                    checked={repo.visibility === "Public"}
                    disabled={pendingRepository === repo.name}
                    onCheckedChange={(checked) => {
                      if (controlled) {
                        onToggle(repo, checked);
                        return;
                      }

                      setItems((current) =>
                        current.map((item) =>
                          item.name === repo.name
                            ? { ...item, visibility: checked ? "Public" : "Hidden" }
                            : item,
                        ),
                      );
                    }}
                    aria-label={`Toggle ${repo.name} visibility`}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div id={repositoriesRegionId} className="neon-surface space-y-3 rounded-[1.75rem] border-dashed px-4 py-4 text-sm text-muted">
          {counts.total === 0 ? (
            <p>
              Repository visibility records are not available in this profile snapshot yet.
              Run a sync to refresh repository privacy controls.
            </p>
          ) : (
            <p>
              No repositories match the current search and visibility filter.
              Reset filters or widen the search scope.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {canReset ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleReset}
                disabled={isFiltering}
                aria-controls={repositoriesRegionId}
              >
                Reset filters
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/settings#settings-account">Run sync in account section</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
