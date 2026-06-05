"use client";

import { startTransition, useDeferredValue, useId, useMemo, useState } from "react";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { EmptyState } from "@/components/shared/EmptyState";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { RemovableFilterChip } from "@/components/shared/RemovableFilterChip";
import { ScrollableRegion } from "@/components/shared/ScrollableRegion";
import { SearchInputWithClear } from "@/components/shared/SearchInputWithClear";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
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
  const searchTerm = search.trim();
  const compactSearch = searchTerm.length > 28 ? `${searchTerm.slice(0, 28)}…` : searchTerm;
  const controlled = typeof onToggle === "function";
  const visibleItems = controlled ? repositories : items;
  const canReset = searchTerm.length > 0 || visibilityFilter !== "All";
  const activeFilterCount =
    (visibilityFilter !== "All" ? 1 : 0) + (searchTerm.length > 0 ? 1 : 0);
  const statusId = useId();
  const controlsHeadingId = useId();
  const repositoriesRegionId = useId();
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
      <ControlSurface as="section">
        <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {`${filteredItems.length} of ${counts.total} repositories`}
        </p>
        <FilterControlsHeader
          labelId={controlsHeadingId}
          label="Repository controls"
          summary={`${filteredItems.length} of ${counts.total} repositories`}
          activeFilterCount={activeFilterCount}
          extraControls={
            searchTerm.length > 0 ? (
              <RemovableFilterChip
                onRemove={handleClearSearch}
                ariaLabel={`Remove Search · ${compactSearch} filter`}
                ariaControls={repositoriesRegionId}
              >
                Search: {compactSearch}
              </RemovableFilterChip>
            ) : null
          }
          resetAction={{
            onReset: handleReset,
            enabled: canReset,
            ariaControls: repositoriesRegionId,
          }}
        />
        <div className="grid gap-3 md:grid-cols-[1fr,15rem]">
          <SearchInputWithClear
            value={search}
            onChange={(value) => {
              startTransition(() => setSearch(value));
            }}
            onClear={handleClearSearch}
            placeholder="Search repository or reason"
            ariaLabel="Search repositories"
            ariaDescribedBy={statusId}
            ariaControls={repositoriesRegionId}
            clearButtonLabel="Clear repository search"
            inputClassName="pl-11 pr-11"
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Visibility</p>
            <SegmentedControl
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
              controlIdPrefix="repo-visibility-filter"
              wrap
            />
          </div>
        </div>
      </ControlSurface>
      <ScrollableRegion
        id={repositoriesRegionId}
        labelledById={controlsHeadingId}
        className="repository-visibility-results-viewport overflow-y-auto pr-1"
      >
        {filteredItems.length > 0 ? (
          <ul role="list" className="grid gap-3">
            {filteredItems.map((repo) => (
              <li key={`${repo.name}:${repo.visibility}:${repo.tracked ? "tracked" : "untracked"}`} className="list-none">
                <div className="render-opt-card neon-surface flex flex-col gap-3 rounded-[var(--radius-universal)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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
          <div className="min-h-[12rem]">
            {counts.total === 0 ? (
              <EmptyState
                eyebrow="Repository privacy"
                title="Repository visibility will appear after sync."
                description="Open dashboard to let auto-sync refresh repository privacy controls."
                actionLabel="Open dashboard"
                actionHref="/dashboard"
              />
            ) : (
              <EmptyState
                eyebrow="Filter results"
                title="No repositories match current filters."
                description="Reset filters or widen the search scope."
                actionLabel="Reset filters"
                onAction={handleReset}
              />
            )}
          </div>
        )}
      </ScrollableRegion>
    </div>
  );
}
