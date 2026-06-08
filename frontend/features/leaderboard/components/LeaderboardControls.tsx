"use client";

import {
  BookText,
  CalendarClock,
  Cpu,
  FlaskConical,
  Globe2,
  TrendingUp,
} from "lucide-react";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Button } from "@/components/ui/button";
import type { LeaderboardTab } from "@/lib/api/leaderboard-api";

export const LEADERBOARD_TABS: LeaderboardTab[] = [
  "Global",
  "Backend",
  "Testing",
  "Documentation",
  "Weekly XP",
  "Rising Contributors",
];

export const LEADERBOARD_TAB_LABELS: Record<LeaderboardTab, string> = {
  Global: "Global",
  Backend: "Backend",
  Testing: "Testing",
  Documentation: "Documentation",
  "Weekly XP": "Weekly XP",
  "Rising Contributors": "Rising",
};

const TAB_COMPACT_LABELS: Record<LeaderboardTab, string> = {
  Global: "Global",
  Backend: "Backend",
  Testing: "Tests",
  Documentation: "Docs",
  "Weekly XP": "Weekly",
  "Rising Contributors": "Rising",
};

const TAB_ICONS: Record<LeaderboardTab, typeof Globe2> = {
  Global: Globe2,
  Backend: Cpu,
  Testing: FlaskConical,
  Documentation: BookText,
  "Weekly XP": CalendarClock,
  "Rising Contributors": TrendingUp,
};

export function LeaderboardControls({
  rowsCount,
  tab,
  isBusy,
  activeFilterCount,
  hasViewFilter,
  showLaneDetails,
  canClearAllControls,
  rowsRegionId,
  viewOptionsToggleId,
  viewOptionsRegionId,
  showViewOptions,
  supportsNearbyMode,
  effectiveMode,
  onReset,
  onTabChange,
  onToggleViewOptions,
  onToggleLaneDetails,
  onToggleNearbyMode,
}: {
  rowsCount: number;
  tab: LeaderboardTab;
  isBusy: boolean;
  activeFilterCount: number;
  hasViewFilter: boolean;
  showLaneDetails: boolean;
  canClearAllControls: boolean;
  rowsRegionId: string;
  viewOptionsToggleId: string;
  viewOptionsRegionId: string;
  showViewOptions: boolean;
  supportsNearbyMode: boolean;
  effectiveMode: "nearby" | "full";
  onReset: () => void;
  onTabChange: (value: LeaderboardTab) => void;
  onToggleViewOptions: () => void;
  onToggleLaneDetails: () => void;
  onToggleNearbyMode: () => void;
}) {
  return (
    <section
      id="leaderboard-controls"
      data-scroll-target="true"
      className="render-opt-section space-y-3"
    >
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isBusy ? `Refreshing ${tab}...` : `Viewing ${tab}`}
      </p>
      <ControlSurface>
        <FilterControlsHeader
          label="Leaderboard controls"
          summary={isBusy ? "Updating lane..." : `${rowsCount} rows`}
          activeFilterCount={activeFilterCount}
          activeCountLabel={`Active: ${activeFilterCount}`}
          secondaryLabel={`Lane: ${LEADERBOARD_TAB_LABELS[tab]}`}
          extraControls={(
            <>
              {hasViewFilter ? (
                <span className="neon-chip neon-chip-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                  View: Full board
                </span>
              ) : null}
              {showLaneDetails ? (
                <span className="neon-chip neon-chip-muted inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                  Details: On
                </span>
              ) : null}
            </>
          )}
          resetAction={{
            onReset,
            enabled: canClearAllControls,
            ariaControls: rowsRegionId,
          }}
        />
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">Lane</p>
          <SegmentedControl
            options={LEADERBOARD_TABS.map((item) => {
              const Icon = TAB_ICONS[item];
              return {
                value: item,
                label: LEADERBOARD_TAB_LABELS[item],
                compactLabel: TAB_COMPACT_LABELS[item],
                icon: <Icon className="h-4 w-4" aria-hidden="true" />,
                minWidthClassName: "min-w-[6.75rem] sm:min-w-[8.5rem]",
              };
            })}
            value={tab}
            onValueChange={onTabChange}
            ariaLabel="Leaderboard lane filters"
            ariaControls={rowsRegionId}
            className="w-full"
            controlIdPrefix="leaderboard-lane-filter"
            wrap
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DisclosureToggle
            id={viewOptionsToggleId}
            controlsId={viewOptionsRegionId}
            expanded={showViewOptions}
            onToggle={onToggleViewOptions}
            collapsedLabel="View options"
            expandedLabel="Hide view options"
          />
        </div>
        <div
          id={viewOptionsRegionId}
          role="region"
          aria-labelledby={viewOptionsToggleId}
          hidden={!showViewOptions}
          className="flex flex-wrap items-center gap-2"
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleLaneDetails}
            aria-controls={rowsRegionId}
            aria-pressed={showLaneDetails}
          >
            {showLaneDetails ? "Hide details" : "Show details"}
          </Button>
          {supportsNearbyMode ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onToggleNearbyMode}
              aria-controls={rowsRegionId}
              aria-pressed={effectiveMode === "nearby"}
            >
              {effectiveMode === "nearby" ? "Show full board" : "Show nearby view"}
            </Button>
          ) : null}
        </div>
      </ControlSurface>
    </section>
  );
}
