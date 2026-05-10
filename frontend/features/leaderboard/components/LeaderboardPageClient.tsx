"use client";

import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardArena } from "@/features/leaderboard/components/LeaderboardArena";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import type { PreviewMode } from "@/types/gitrank";

const tabs = ["Global", "India", "College", "Backend", "Testing", "Documentation", "Weekly XP", "Rising Contributors"] as const;

export function LeaderboardPageClient({ preview }: { preview?: PreviewMode }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Global");
  const { data, isLoading, isError } = useLeaderboard(tab, preview);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard arena"
        description="A time-windowed ranking snapshot weighted by meaningful merged work, review depth, tests, and project context."
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof tabs)[number])}>
        <TabsList className="scrollbar-thin w-full overflow-x-auto whitespace-nowrap">
          {tabs.map((item) => (
            <TabsTrigger key={item} value={item}>
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="rounded-[1.75rem] border border-primary/18 bg-primary/8 px-4 py-3 text-sm text-slate-200">
        Snapshot note: leaderboard placement is directional, not a final measure of engineering ability. Quality weighting reduces the impact of shallow, unreviewed, or repetitive PR floods.
      </div>
      {isLoading ? <LoadingState message="Updating the arena ladder..." /> : null}
      {isError ? (
        <ErrorState
          title="Leaderboard unavailable"
          description="The ranking snapshot could not be refreshed. Retry or keep browsing your existing public profile."
        />
      ) : null}
      {!isLoading && !isError && data?.length === 0 ? (
        <EmptyState
          title="Leaderboard unlocks after your first verified score."
          description="Meaningful merged work is required before a profile joins the arena."
          actionLabel="Go to onboarding"
        />
      ) : null}
      {!isLoading && !isError && data?.length ? <LeaderboardArena rows={data} /> : null}
    </div>
  );
}
