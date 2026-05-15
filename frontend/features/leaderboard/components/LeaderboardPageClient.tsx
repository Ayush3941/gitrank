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
import { useMyProfile } from "@/hooks/use-profile";
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
  const { data: myProfile } = useMyProfile();
  const snapshot = data ?? null;
  const projectedRank = data && myProfile ? projectRank(data.rows, myProfile.user.gitRankScore) : null;
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
      {!isLoading && !isError && rows.length === 0 ? (
        <GlowCard strong className="space-y-4 border border-cyan-300/28 bg-gradient-to-br from-slate-950/90 via-cyan-950/30 to-fuchsia-950/25">
          <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">Arena preview state</p>
          <h2 className="text-2xl font-semibold text-white">The arena is warming up</h2>
          <p className="text-sm text-slate-200/84">
            No live public rows are available in this snapshot yet. This is a preview frame, not live competitor data.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <PreviewBand name="Bronze Foundry" range="Ranks 200-81" cue="Entry lane for first verified score cycles." />
            <PreviewBand name="Silver Workshop" range="Ranks 80-31" cue="Consistent weekly evidence and streak retention." />
            <PreviewBand name="Gold Forge+" range="Ranks 30-1" cue="High-impact score movement and sustained quality." />
          </div>
          <div className="rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100">
            {projectedRank
              ? `Projected position after your next scored cycle: around #${projectedRank}.`
              : "Complete one scored contribution to receive your initial projected position."}
          </div>
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

function projectRank(rows: Array<{ totalXp: number; rank: number }>, currentXp: number): number | null {
  if (!Number.isFinite(currentXp) || currentXp <= 0) {
    return null;
  }
  if (rows.length === 0) {
    return Math.max(1, 200 - Math.floor(currentXp / 120));
  }
  const sorted = [...rows].sort((left, right) => left.rank - right.rank);
  const betterCount = sorted.filter((row) => row.totalXp > currentXp).length;
  return betterCount + 1;
}

function PreviewBand({
  name,
  range,
  cue,
}: {
  name: string;
  range: string;
  cue: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-cyan-300/18 bg-black/25 px-4 py-3">
      <p className="text-sm font-semibold text-white">{name}</p>
      <p className="mt-1 text-xs text-cyan-200">{range}</p>
      <p className="mt-2 text-xs text-slate-300">{cue}</p>
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
    <div className="rounded-[1.35rem] border border-white/12 bg-black/25 px-4 py-3">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-300">{body}</p>
    </div>
  );
}
