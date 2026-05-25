"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
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
  const controlled = typeof onToggle === "function";
  const visibleItems = controlled ? repositories : items;
  const canReset = search.trim().length > 0 || visibilityFilter !== "All";
  const statusId = "settings-repositories-filter-status";
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
        visibilityFilter === "All" || repo.visibility === visibilityFilter;
      const searchMatch =
        term.length === 0 ||
        repo.name.toLowerCase().includes(term) ||
        repo.reason.toLowerCase().includes(term);
      return visibilityMatch && searchMatch;
    });
  }, [deferredSearch, visibilityFilter, visibleItems]);

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

  return (
    <div className="repository-visibility-panel-shell space-y-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={statusId} role="status" aria-live="polite" className="sr-only">
            {`${filteredItems.length} of ${counts.total} repositories`}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Public {counts.public}</span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Hidden {counts.hidden}</span>
          </div>
        </div>
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
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Visibility</p>
            <SegmentedTablist
              options={[
                {
                  value: "All",
                  label: "All",
                  count: counts.total,
                  minWidthClassName: "min-w-[6.5rem]",
                },
                {
                  value: "Public",
                  label: "Public",
                  count: counts.public,
                  minWidthClassName: "min-w-[6.5rem]",
                },
                {
                  value: "Hidden",
                  label: "Hidden",
                  count: counts.hidden,
                  minWidthClassName: "min-w-[6.5rem]",
                },
              ]}
              value={visibilityFilter}
              onValueChange={(next) => {
                startTransition(() => {
                  setVisibilityFilter(next);
                });
              }}
              ariaLabel="Repository visibility filter"
              ariaDescribedBy={statusId}
              ariaControls={repositoriesRegionId}
              tabIdPrefix="repo-visibility-filter-tab"
              wrap={false}
            />
          </div>
        </div>
      </div>
      <div
        id={repositoriesRegionId}
        className="repository-visibility-results-viewport h-[24rem] overflow-y-auto pr-1"
      >
        {filteredItems.length > 0 ? (
          <ul role="list" className="grid gap-3">
            {filteredItems.map((repo, index) => (
              <li key={`${repo.name}-${repo.visibility}-${index}`} className="list-none">
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
          <div className="neon-surface space-y-3 rounded-[1.75rem] border-dashed px-4 py-4 text-sm text-muted">
            {counts.total === 0 ? (
              <p>
                Repository visibility records will appear here after the next profile sync.
                Open sync settings to refresh repository privacy controls now.
              </p>
            ) : (
              <p>
                No repositories match the current search and visibility filter.
                Clear filters or widen the search scope.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleReset}
                aria-controls={repositoriesRegionId}
                disabled={!canReset}
              >
                Reset
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard" prefetch={false}>Open dashboard</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
