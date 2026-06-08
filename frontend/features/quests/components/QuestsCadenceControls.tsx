"use client";

import {
  CalendarClock,
  CalendarDays,
  LayoutGrid,
  Route,
  Sparkles,
} from "lucide-react";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import type {
  QuestCadenceCounts,
  QuestCadenceFilter,
} from "@/features/quests/lib/quests-page-model";

const QUEST_FILTERS: Array<{ value: QuestCadenceFilter; label: string }> = [
  { value: "All", label: "All" },
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Long-term", label: "Long-term" },
  { value: "Skill-based", label: "Skill-based" },
];

export function QuestsCadenceControls({
  totalQuestCount,
  cadenceCounts,
  value,
  displayValue,
  isFiltering,
  canReset,
  filterStatusId,
  missionsRegionId,
  onValueChange,
}: {
  totalQuestCount: number;
  cadenceCounts: QuestCadenceCounts;
  value: QuestCadenceFilter;
  displayValue: QuestCadenceFilter;
  isFiltering: boolean;
  canReset: boolean;
  filterStatusId: string;
  missionsRegionId: string;
  onValueChange: (value: QuestCadenceFilter) => void;
}) {
  const visibleQuestCount = questCountForFilter(displayValue, totalQuestCount, cadenceCounts);
  const statusMissionLabel = missionStatusLabel(displayValue, visibleQuestCount);
  const summaryMissionLabel = missionSummaryLabel(displayValue, visibleQuestCount);

  return (
    <div className="space-y-3">
      <p id={filterStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isFiltering ? "Updating missions…" : `Showing ${statusMissionLabel}`}
      </p>
      <ControlSurface>
        <FilterControlsHeader
          label="Mission controls"
          summary={isFiltering ? "Updating missions..." : summaryMissionLabel}
          activeFilterCount={canReset ? 1 : 0}
          resetAction={{
            onReset: () => {
              onValueChange("All");
            },
            enabled: canReset,
            ariaControls: missionsRegionId,
          }}
        />
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">Cadence lane</p>
          <SegmentedControl
            options={QUEST_FILTERS.map((item) => {
              const count = questCountForFilter(item.value, totalQuestCount, cadenceCounts);
              const Icon = iconForFilter(item.value);
              return {
                value: item.value,
                label: item.label,
                compactLabel: compactFilterLabel(item.value, item.label),
                icon: <Icon className="h-4 w-4" aria-hidden="true" />,
                count,
                minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
              };
            })}
            value={value}
            onValueChange={onValueChange}
            ariaLabel="Mission cadence filters"
            ariaDescribedBy={filterStatusId}
            ariaControls={missionsRegionId}
            controlIdPrefix="quest-filter"
            wrap
          />
        </div>
      </ControlSurface>
    </div>
  );
}

function questCountForFilter(
  filter: QuestCadenceFilter,
  totalQuestCount: number,
  cadenceCounts: QuestCadenceCounts,
) {
  return filter === "All" ? totalQuestCount : cadenceCounts[filter];
}

function missionStatusLabel(filter: QuestCadenceFilter, count: number) {
  if (filter === "All") {
    return `all ${count} missions`;
  }
  return `${count} ${filter.toLowerCase()} missions`;
}

function missionSummaryLabel(filter: QuestCadenceFilter, count: number) {
  if (filter === "All") {
    return `${count} missions`;
  }
  return `${count} ${filter.toLowerCase()} missions`;
}

function iconForFilter(filter: QuestCadenceFilter) {
  if (filter === "All") {
    return LayoutGrid;
  }
  if (filter === "Daily") {
    return CalendarClock;
  }
  if (filter === "Weekly") {
    return CalendarDays;
  }
  if (filter === "Long-term") {
    return Route;
  }
  return Sparkles;
}

function compactFilterLabel(filter: QuestCadenceFilter, label: string) {
  if (filter === "Skill-based") {
    return "Skills";
  }
  if (filter === "Long-term") {
    return "Long";
  }
  return label;
}
