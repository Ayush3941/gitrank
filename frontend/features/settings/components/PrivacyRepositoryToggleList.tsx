"use client";

import Link from "next/link";
import { Search } from "lucide-react";
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
  const statusId = "settings-repositories-filter-status";
  const visibilityGroupId = "settings-repositories-visibility-group";
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

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={statusId} role="status" aria-live="polite" className="text-xs tracking-[0.2em] text-cyan-200 uppercase">
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
            >
              Reset
            </Button>
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
              className="pl-11"
              placeholder="Search repository or reason"
              aria-label="Search repositories"
              aria-describedby={statusId}
            />
          </div>
          <div aria-labelledby={visibilityGroupId} className="grid grid-cols-3 gap-2">
            <span id={visibilityGroupId} className="sr-only">
              Repository visibility filter
            </span>
            {(["All", "Public", "Hidden"] as const).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={visibilityFilter === item ? "default" : "secondary"}
                onClick={() => startTransition(() => setVisibilityFilter(item))}
                disabled={isFiltering}
                aria-describedby={statusId}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {filteredItems.length > 0 ? (
        filteredItems.map((repo) => (
          <div key={repo.name} className="render-opt-card neon-surface flex flex-col gap-3 rounded-[1.75rem] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-white">{repo.name}</p>
              <p className="text-sm text-muted">{repo.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">{repo.visibility}</span>
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
        ))
      ) : (
        <div className="neon-surface space-y-3 rounded-[1.75rem] border-dashed px-4 py-4 text-sm text-muted">
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
