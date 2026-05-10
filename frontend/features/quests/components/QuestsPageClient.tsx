"use client";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { QuestCard } from "@/features/quests/components/QuestCard";
import { useQuests } from "@/hooks/use-quests";
import type { PreviewMode, Quest } from "@/types/gitrank";

const groups: Array<Quest["cadence"]> = ["Daily", "Weekly", "Long-term", "Skill-based"];

export function QuestsPageClient({ preview }: { preview?: PreviewMode }) {
  const { data, isLoading, isError } = useQuests(preview);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quest board"
        description="Daily, weekly, and long-range objectives tuned to the least-observed skill tracks and biggest improvement opportunities in your current snapshot."
      />
      {isLoading ? <LoadingState message="Building your skill tree..." /> : null}
      {isError ? (
        <ErrorState
          title="Quest engine unavailable"
          description="The recommendation system could not finish. Retry or fall back to your last synced quest board."
        />
      ) : null}
      {!isLoading && !isError && data?.length === 0 ? (
        <EmptyState
          title="No quests ready yet."
          description="Leaderboard unlocks after your first verified score, and quests sharpen once the system sees enough meaningful work."
          actionLabel="Sync profile"
        />
      ) : null}
      {!isLoading && !isError && data ? (
        groups.map((group) => {
          const quests = data.filter((quest) => quest.cadence === group);
          if (!quests.length) return null;

          return (
            <section key={group} className="space-y-4">
              <SectionHeader
                title={group}
                description={`Progression tasks for the ${group.toLowerCase()} loop.`}
              />
              <div className="grid gap-4 xl:grid-cols-2">
                {quests.map((quest) => (
                  <QuestCard key={quest.id} quest={quest} />
                ))}
              </div>
            </section>
          );
        })
      ) : null}
    </div>
  );
}
