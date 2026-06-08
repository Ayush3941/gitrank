"use client";

import {
  Gem,
  Lock,
  Medal,
  Unlock,
} from "lucide-react";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import type {
  BadgeRarityFilter,
  BadgeVisibilityFilter,
} from "@/features/badges/lib/badge-shelf-model";

const BADGE_RARITY_FILTERS: BadgeRarityFilter[] = [
  "All",
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
];

const BADGE_VISIBILITY_FILTERS: BadgeVisibilityFilter[] = [
  "All",
  "Unlocked",
  "Locked",
];

function compactBadgeRarityLabel(rarity: BadgeRarityFilter) {
  return rarity === "Legendary" ? "Legend" : rarity;
}

export function BadgesShelfControls({
  filteredCount,
  totalCount,
  unlockedCount,
  isFiltering,
  activeFilterCount,
  canResetFilters,
  filterStatusId,
  earnedRegionId,
  advancedFiltersToggleId,
  advancedFiltersRegionId,
  visibility,
  rarity,
  showAdvancedFilters,
  onVisibilityChange,
  onRarityChange,
  onResetFilters,
  onToggleAdvancedFilters,
}: {
  filteredCount: number;
  totalCount: number;
  unlockedCount: number;
  isFiltering: boolean;
  activeFilterCount: number;
  canResetFilters: boolean;
  filterStatusId: string;
  earnedRegionId: string;
  advancedFiltersToggleId: string;
  advancedFiltersRegionId: string;
  visibility: BadgeVisibilityFilter;
  rarity: BadgeRarityFilter;
  showAdvancedFilters: boolean;
  onVisibilityChange: (value: BadgeVisibilityFilter) => void;
  onRarityChange: (value: BadgeRarityFilter) => void;
  onResetFilters: () => void;
  onToggleAdvancedFilters: () => void;
}) {
  return (
    <div className="space-y-3">
      <p id={filterStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        Showing {filteredCount} of {totalCount} badges
      </p>
      <ControlSurface>
        <FilterControlsHeader
          label="Badge controls"
          summary={isFiltering ? "Updating shelf..." : `${filteredCount} of ${totalCount} badges`}
          activeFilterCount={activeFilterCount}
          resetAction={{
            onReset: onResetFilters,
            enabled: canResetFilters,
            ariaControls: earnedRegionId,
          }}
        />
        <div className="grid gap-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">State</p>
            <SegmentedControl
              options={BADGE_VISIBILITY_FILTERS.map((item) => {
                const Icon = item === "Unlocked" ? Unlock : item === "Locked" ? Lock : Medal;
                const count =
                  item === "All"
                    ? totalCount
                    : item === "Unlocked"
                      ? unlockedCount
                      : totalCount - unlockedCount;
                return {
                  value: item,
                  label: item,
                  icon: <Icon className="h-4 w-4" aria-hidden="true" />,
                  count,
                  minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
                };
              })}
              value={visibility}
              onValueChange={onVisibilityChange}
              ariaLabel="Badge visibility filters"
              ariaDescribedBy={filterStatusId}
              ariaControls={earnedRegionId}
              controlIdPrefix="badge-visibility-filter"
              wrap
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted">
              Use state first. Open advanced filters for rarity lanes.
            </p>
            <DisclosureToggle
              id={advancedFiltersToggleId}
              controlsId={advancedFiltersRegionId}
              expanded={showAdvancedFilters}
              onToggle={onToggleAdvancedFilters}
              collapsedLabel="Advanced filters"
              expandedLabel="Hide advanced"
            />
          </div>
          <div
            id={advancedFiltersRegionId}
            role="region"
            aria-labelledby={advancedFiltersToggleId}
            hidden={!showAdvancedFilters}
            className="space-y-2"
          >
            <p className="text-xs font-medium text-primary">Rarity</p>
            <SegmentedControl
              options={BADGE_RARITY_FILTERS.map((item) => ({
                value: item,
                label: item,
                compactLabel: compactBadgeRarityLabel(item),
                icon: <Gem className="h-4 w-4" aria-hidden="true" />,
                minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
              }))}
              value={rarity}
              onValueChange={onRarityChange}
              ariaLabel="Badge rarity filters"
              ariaDescribedBy={filterStatusId}
              ariaControls={earnedRegionId}
              controlIdPrefix="badge-rarity-filter"
              wrap
            />
          </div>
        </div>
      </ControlSurface>
    </div>
  );
}
