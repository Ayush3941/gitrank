"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardArena } from "@/features/leaderboard/components/LeaderboardArena";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useMyProfile } from "@/hooks/use-profile";
import type { LeaderboardTab } from "@/lib/api/leaderboard-api";
import { formatRelativeDays } from "@/lib/formatters";

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
  const deferredTab = useDeferredValue(tab);
  const { data, isLoading, isError, isFetching, refetch } = useLeaderboard(deferredTab);
  const { data: myProfile, refetch: refetchMyProfile } = useMyProfile();
  const isSwitchingTab = deferredTab !== tab;
  const currentUserHandle = myProfile?.user.username.toLowerCase() ?? "";
  const rows = (data?.rows ?? []).map((row) => ({
    ...row,
    isCurrentUser:
      currentUserHandle.length > 0 &&
      row.username.toLowerCase() === currentUserHandle,
  }));
  const snapshot = data
    ? {
        ...data,
        rows,
        currentUser: rows.find((row) => row.isCurrentUser),
      }
    : null;

  function handleTabChange(value: string) {
    startTransition(() => setTab(value as LeaderboardTab));
  }

  return (
    <div className="space-y-6" aria-busy={(isSwitchingTab || (isFetching && snapshot)) || undefined}>
      <PageHeader
        title="Leaderboard arena"
        description="A time-windowed ranking snapshot weighted by meaningful merged work, review depth, tests, and project context."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/contributions">Open contributions</Link>
          </Button>
        )}
      />
      {myProfile?.user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Leaderboard context refreshed ${formatRelativeDays(
            myProfile.refreshedAt,
          )}. Rank movement can lag until the next profile sync completes.`}
          onRefresh={() => {
            void refetchMyProfile();
            void refetch();
          }}
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="leaderboard:stale"
        />
      ) : null}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="scrollbar-thin w-full overflow-x-auto whitespace-nowrap">
          {tabs.map((item) => (
            <TabsTrigger key={item} value={item}>
              {item}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p role="status" aria-live="polite" className="text-xs tracking-[0.2em] text-cyan-200 uppercase">
        {isSwitchingTab || (isFetching && snapshot)
          ? `Refreshing ${tab} snapshot...`
          : `Viewing ${tab} snapshot`}
      </p>
      <div className="neon-callout rounded-[1.75rem] px-4 py-3 text-sm text-slate-200">
        Snapshot note: leaderboard placement is directional, not a final measure of engineering ability. Quality weighting reduces the impact of shallow, unreviewed, or repetitive PR floods.
      </div>
      {isLoading ? <LoadingState message="Updating the arena ladder..." /> : null}
      {isError ? (
        <ErrorState
          title="Leaderboard unavailable"
          description="The ranking snapshot could not be refreshed. Retry or keep browsing your existing public profile."
          fallbackLabel="Open dashboard"
          fallbackHref="/dashboard"
          analyticsTarget="leaderboard:error"
        />
      ) : null}
      {!isLoading && !isError && rows.length === 0 ? (
        <EmptyState
          title="No public leaderboard rows yet"
          description="GitRank does not fabricate leaderboard identities. Rows appear only after contributors complete OAuth, sync, and enable public participation."
          actionLabel="Open contributions"
          actionHref="/dashboard/contributions"
          analyticsTarget="leaderboard:no-live-rows"
        />
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
          actionLabel="Open contributions"
          actionHref="/dashboard/contributions"
          analyticsTarget="leaderboard:empty"
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
