"use client";

import dynamic from "next/dynamic";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { Button } from "@/components/ui/button";
import type { BadgeStory } from "@/lib/ai/abra-insights-types";
import type { Badge } from "@/types/gitrank";

const BadgeGrid = dynamic(
  () =>
    import("@/features/badges/components/BadgeGrid").then(
      (mod) => mod.BadgeGrid,
    ),
  {
    loading: () => <BadgeShelfPlaceholder label="Loading badge shelf" />,
  },
);

export function BadgesShelfResults({
  visibleBadges,
  stories,
  isLoading,
  isError,
  filteredCount,
  totalCount,
  canResetFilters,
  hasMoreBadges,
  remainingBadges,
  regionId,
  onRetry,
  onResetFilters,
  onShowMoreBadges,
}: {
  visibleBadges: Badge[];
  stories?: Record<string, BadgeStory>;
  isLoading: boolean;
  isError: boolean;
  filteredCount: number;
  totalCount: number;
  canResetFilters: boolean;
  hasMoreBadges: boolean;
  remainingBadges: number;
  regionId: string;
  onRetry: () => void;
  onResetFilters: () => void;
  onShowMoreBadges: () => void;
}) {
  if (isLoading) {
    return <LoadingState message="Badge shelf" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Badge sync failed"
        description="Badge refresh failed. Retry or use your latest snapshot."
        onRetry={onRetry}
        fallbackLabel="Open sync settings"
        fallbackHref="/dashboard/settings"
        analyticsTarget="badges:error"
      />
    );
  }

  if (filteredCount === 0) {
    const emptyFilteredState = canResetFilters && totalCount > 0;
    return (
      <EmptyState
        eyebrow={emptyFilteredState ? "Filter results" : "Badge progression"}
        title={emptyFilteredState ? "No badges match current filters." : "Your badge shelf is waiting."}
        description={
          emptyFilteredState
            ? "Reset filters to view earned and locked badges."
            : "Complete a meaningful merged PR to unlock badges."
        }
        actionLabel={emptyFilteredState ? "Reset filters" : "Open quests"}
        actionHref={emptyFilteredState ? undefined : "/dashboard/quests"}
        onAction={emptyFilteredState ? onResetFilters : undefined}
        analyticsTarget={emptyFilteredState ? "badges:empty-filtered" : "badges:empty"}
      />
    );
  }

  return (
    <div className="space-y-3">
      <BadgeGrid badges={visibleBadges} stories={stories} />
      {hasMoreBadges ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{remainingBadges} badges remaining</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            aria-controls={regionId}
            onClick={onShowMoreBadges}
          >
            Show more badges
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function BadgeShelfPlaceholder({ label }: { label: string }) {
  return (
    <PanelLoadingPlaceholder
      label={label}
      minHeightClassName="min-h-[18rem]"
      skeletons={[
        { className: "h-9 w-1/2" },
        { className: "h-24 w-full" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
