"use client";

import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardArena } from "@/features/leaderboard/components/LeaderboardArena";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import type { LeaderboardTab } from "@/lib/api/leaderboard-api";

const tabs: LeaderboardTab[] = [
  "Global",
  "Backend",
  "Testing",
  "Documentation",
  "Weekly XP",
  "Rising Contributors",
];

export function LeaderboardPageClient() {
  const [tab, setTab] = useState<LeaderboardTab>("Global");
  const { data, isLoading, isError } = useLeaderboard(tab);
  const snapshot = data ?? null;
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard arena"
        description="A time-windowed ranking snapshot weighted by meaningful merged work, review depth, tests, and project context."
      />
      <Tabs value={tab} onValueChange={(value) => setTab(value as LeaderboardTab)}>
        <TabsList className="scrollbar-thin w-full overflow-x-auto whitespace-nowrap">
          {tabs.map((item) => (
            <TabsTrigger key={item} value={item}>
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="neon-callout rounded-[1.75rem] px-4 py-3 text-sm text-slate-200">
        Snapshot note: leaderboard placement is directional, not a final measure of engineering ability. Quality weighting reduces the impact of shallow, unreviewed, or repetitive PR floods.
      </div>
      {isLoading ? <LoadingState message="Updating the arena ladder..." /> : null}
      {isError ? (
        <ErrorState
          title="Leaderboard unavailable"
          description="The ranking snapshot could not be refreshed. Retry or keep browsing your existing public profile."
        />
      ) : null}
      {!isLoading && !isError && rows.length === 0 ? (
        <GlowCard strong className="space-y-4">
          <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">Live data required</p>
          <h2 className="text-2xl font-semibold text-white">No public leaderboard rows yet</h2>
          <p className="text-sm text-slate-200/84">
            GitRank does not fabricate leaderboard identities. Rows appear only after contributors complete OAuth, sync, and enable public participation.
          </p>
        </GlowCard>
      ) : null}
      {!isLoading && !isError && snapshot && rows.length ? (
        <>
          <LeaderboardArena snapshot={snapshot} />
          <GlowCard className="space-y-3 border border-fuchsia-300/22 bg-gradient-to-br from-slate-950/90 to-fuchsia-950/20">
            <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">How to climb</p>
            <div className="grid gap-3 md:grid-cols-3">
              <ClimbTip title="Raise review depth" body="Address maintainer feedback loops quickly; review quality raises signal trust." />
              <ClimbTip title="Increase weekly impact" body="Prefer merged changes with measurable scope over low-signal micro churn." />
              <ClimbTip title="Preserve streak cadence" body="Consistent weekly evidence improves movement and reduces demotion risk." />
            </div>
          </GlowCard>
        </>
      ) : null}
      {!isLoading && !isError && rows.length < 5 && rows.length > 0 ? (
        <EmptyState
          title="Sparse live leaderboard data"
          description="This arena currently has limited active profiles. Rank movement is real, but competitive context is still building."
        />
      ) : null}
    </div>
  );
}

function ClimbTip({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="neon-metric rounded-[1.35rem] px-4 py-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-300">{body}</p>
    </div>
  );
}
