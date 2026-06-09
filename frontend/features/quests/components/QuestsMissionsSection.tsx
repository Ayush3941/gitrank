"use client";

import dynamic from "next/dynamic";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { Button } from "@/components/ui/button";
import type { QuestGroupMap } from "@/features/quests/lib/quests-page-model";
import { buildStableRenderRows } from "@/lib/presentation/render-identity";
import type { Quest } from "@/types/gitrank";

const QuestCard = dynamic(
  () =>
    import("@/features/quests/components/QuestCard").then(
      (mod) => mod.QuestCard,
    ),
  {
    loading: () => <QuestPanelPlaceholder />,
  },
);

export function QuestsMissionsSection({
  quests,
  visibleGroups,
  questMap,
  visibleGroupCounts,
  questGroupPageSize,
  isLoading,
  isError,
  onRetry,
  onShowMoreGroup,
}: {
  quests: Quest[];
  visibleGroups: Quest["cadence"][];
  questMap: QuestGroupMap;
  visibleGroupCounts: Record<Quest["cadence"], number>;
  questGroupPageSize: number;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onShowMoreGroup: (group: Quest["cadence"], totalCount: number) => void;
}) {
  return (
    <section id="quests-missions" data-scroll-target="true" className="render-opt-section space-y-4">
      {isLoading ? <LoadingState message="Quest lanes" /> : null}
      {isError ? (
        <ErrorState
          title="Quest engine unavailable"
          description="Quest recommendations are unavailable right now. Retry or open sync settings."
          onRetry={onRetry}
          fallbackLabel="Open sync settings"
          fallbackHref="/dashboard/settings"
          analyticsTarget="quests:error"
        />
      ) : null}
      {!isLoading && !isError && quests.length === 0 ? (
        <EmptyState
          eyebrow="Quest generation"
          title="No quests ready yet."
          description="Sync and complete scored contributions to unlock quests."
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="quests:empty"
        />
      ) : null}
      {!isLoading && !isError ? (
        visibleGroups.map((group) => {
          const grouped = questMap[group];
          const visibleCount = visibleGroupCounts[group] ?? questGroupPageSize;
          const visibleGroup = grouped.slice(0, visibleCount);
          const visibleRows = buildStableRenderRows(
            visibleGroup,
            (quest) => `${quest.cadence}:${quest.title}:${quest.rewardXp}`,
            (quest) => quest.id,
          );
          const hasMoreInGroup = grouped.length > visibleGroup.length;
          const remainingInGroup = Math.max(0, grouped.length - visibleGroup.length);

          return (
            <section key={group} className="space-y-4">
              <h3 className="text-sm font-semibold text-white">
                {labelForGroup(group)} ({grouped.length})
              </h3>
              <div>
                <ul role="list" className="grid gap-4 xl:grid-cols-2">
                  {visibleRows.map(({ renderId, item: quest }) => (
                    <li key={renderId} className="list-none">
                      <QuestCard quest={quest} />
                    </li>
                  ))}
                </ul>
                {hasMoreInGroup ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">{remainingInGroup} missions remaining</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        onShowMoreGroup(group, grouped.length);
                      }}
                    >
                      Show more missions
                    </Button>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })
      ) : null}
    </section>
  );
}

function labelForGroup(group: Quest["cadence"]): string {
  if (group === "Daily") return "Today's Quest";
  if (group === "Weekly") return "Weekly Challenge";
  if (group === "Long-term") return "Long-Term Contributor Journey";
  return "Skill-based Missions";
}

function QuestPanelPlaceholder() {
  return (
    <PanelLoadingPlaceholder
      label="Loading quest card"
      skeletons={[
        { className: "h-9 w-2/5" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
