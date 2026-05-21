"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { startTransition, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const controlled = typeof onToggle === "function";
  const visibleItems = controlled ? repositories : items;
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
    const term = search.trim().toLowerCase();

    return visibleItems.filter((repo) => {
      const visibilityMatch =
        visibilityFilter === "All" || repo.visibility === visibilityFilter;
      const searchMatch =
        term.length === 0 ||
        repo.name.toLowerCase().includes(term) ||
        repo.reason.toLowerCase().includes(term);
      return visibilityMatch && searchMatch;
    });
  }, [search, visibilityFilter, visibleItems]);

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
    <div className="space-y-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id={statusId} role="status" aria-live="polite" className="text-xs font-medium text-cyan-200">
            {`${filteredItems.length} of ${counts.total} repositories`}
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Public {counts.public}</span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">Hidden {counts.hidden}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={!canReset}
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
              </span>
            ) : null}
            {visibilityFilter !== "All" ? (
              <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs">
                State: {visibilityFilter}
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
          <div className="sm:hidden">
            <Select
              value={visibilityFilter}
              onValueChange={(value) => {
                startTransition(() => {
                  setVisibilityFilter(value as "All" | "Public" | "Hidden");
                });
              }}
            >
              <SelectTrigger
                aria-label="Repository visibility filter"
                aria-describedby={statusId}
                aria-controls={repositoriesRegionId}
              >
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Public">Public</SelectItem>
                <SelectItem value="Hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="hidden sm:block">
            <span id={visibilityGroupId} className="sr-only">
              Repository visibility filter
            </span>
            <ul role="list" aria-labelledby={visibilityGroupId} className="grid grid-cols-3 gap-2">
              {(["All", "Public", "Hidden"] as const).map((item, index) => (
                <li key={`repo-visibility-filter-${index}-${item}`} className="list-none">
                  <Button
                    type="button"
                    size="sm"
                    variant={visibilityFilter === item ? "default" : "secondary"}
                    onClick={() => {
                      startTransition(() => {
                        setVisibilityFilter(item);
                      });
                    }}
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
      </div>
      {filteredItems.length > 0 ? (
        <ul
          id={repositoriesRegionId}
          role="list"
          className="grid gap-3"
        >
          {filteredItems.map((repo, index) => (
            <li key={`${repo.name}-${index}`} className="list-none">
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
        <div
          id={repositoriesRegionId}
          className="neon-surface space-y-3 rounded-[1.75rem] border-dashed px-4 py-4 text-sm text-muted"
        >
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
                aria-controls={repositoriesRegionId}
              >
                Reset filters
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard" prefetch={false}>Open dashboard sync lane</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
