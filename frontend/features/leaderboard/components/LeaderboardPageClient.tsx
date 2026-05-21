"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Target, Trophy } from "lucide-react";
import { startTransition, useDeferredValue, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { SyncStateGuide, shouldShowSyncStateGuide } from "@/components/shared/SyncStateGuide";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardArena } from "@/features/leaderboard/components/LeaderboardArena";
import { laneParamToTab, tabToLaneParam } from "@/features/leaderboard/lib/lane-param";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
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

const TAB_LABELS: Record<LeaderboardTab, { full: string; short: string }> = {
  Global: { full: "Global", short: "Global" },
  Backend: { full: "Backend", short: "Backend" },
  Testing: { full: "Testing", short: "Testing" },
  Documentation: { full: "Documentation", short: "Docs" },
  "Weekly XP": { full: "Weekly XP", short: "Weekly" },
  "Rising Contributors": { full: "Rising Contributors", short: "Rising" },
};

const LEADERBOARD_ROW_PAGE_SIZE_DEFAULT = 24;
const LEADERBOARD_ROW_PAGE_SIZE_CONSTRAINED = 12;
const LEADERBOARD_ROWS_REGION_ID = "leaderboard-rows-region";

export function LeaderboardPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const constrainedNetwork = useNetworkConstraintPreference();
  const rowPageSize = constrainedNetwork
    ? LEADERBOARD_ROW_PAGE_SIZE_CONSTRAINED
    : LEADERBOARD_ROW_PAGE_SIZE_DEFAULT;
  const [visibleRowCount, setVisibleRowCount] = useState(rowPageSize);
  const [showMissionPlan, setShowMissionPlan] = useState(false);
  const tabFromURL = laneParamToTab(searchParams.get("lane"));
  const tab = tabFromURL ?? "Global";
  const deferredTab = useDeferredValue(tab);
  const { data, isLoading, isError, isFetching, refetch } = useLeaderboard(deferredTab);
  const {
    data: myProfile,
    isFetching: isFetchingMyProfile,
    refetch: refetchMyProfile,
  } = useMyProfile();
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
  const safeVisibleRowCount = Math.min(rows.length, visibleRowCount);
  const hasMoreRows = rows.length > safeVisibleRowCount;
  const remainingRows = Math.max(0, rows.length - safeVisibleRowCount);
  const laneLeader = rows[0];
  const laneGapToLeader =
    snapshot?.currentUser && laneLeader
      ? Math.max(0, laneLeader.seasonXp - snapshot.currentUser.seasonXp)
      : 0;
  const currentUserProgressToNextBand = snapshot?.currentUser
    ? progressToNextBand(snapshot.currentUser.seasonXp, snapshot.currentUser.xpToNextRank)
    : 0;

  function handleTabChange(value: string) {
    const nextTab = value as LeaderboardTab;
    const lane = tabToLaneParam(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("lane", lane);
    const query = nextParams.toString();
    startTransition(() => {
      setVisibleRowCount(rowPageSize);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const isBusy = isSwitchingTab || (isFetching && Boolean(snapshot));

  return (
    <div className="space-y-6" aria-busy={isBusy || undefined}>
      <PageHeader
        eyebrow="Leaderboard"
        title="Rank arena"
        description="Compare rank lanes, season movement, and promotion progress from live evidence."
      />
      {myProfile && shouldShowSyncStateGuide(myProfile.user.syncStatus) ? (
        <SyncStateGuide
          status={myProfile.user.syncStatus}
          className="render-opt-section border-primary/24 bg-primary/8"
        />
      ) : null}
      {myProfile?.user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Leaderboard context refreshed ${formatRelativeDays(
            myProfile.refreshedAt,
          )}. Rank updates may lag until the next sync.`}
          updatedAt={myProfile.refreshedAt}
          onRefresh={() => {
            void refetchMyProfile();
            void refetch();
          }}
          isRefreshing={isFetching || isFetchingMyProfile}
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="leaderboard:stale"
        />
      ) : null}
      <section id="leaderboard-filters" className="scroll-mt-24 space-y-3">
        <div className="sm:hidden">
          <label className="neon-surface flex h-11 items-center rounded-[0.1rem] border border-primary/28 px-3">
            <span className="sr-only">Leaderboard lane filter</span>
            <select
              value={tab}
              onChange={(event) => handleTabChange(event.target.value)}
              aria-label="Leaderboard lane filter"
              aria-controls={LEADERBOARD_ROWS_REGION_ID}
              className="focus-ring h-full w-full bg-transparent text-sm text-foreground outline-none"
            >
              {tabs.map((item) => (
                <option key={`leaderboard-lane-option-${item}`} value={item} className="bg-card text-foreground">
                  {TAB_LABELS[item].full}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="hidden sm:block">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList
              className="grid w-full grid-cols-3 gap-1.5 lg:grid-cols-6"
              aria-label="Leaderboard lane filters"
            >
              {tabs.map((item, index) => (
                <TabsTrigger
                  key={`leaderboard-tab-${index}-${item}`}
                  value={item}
                  aria-label={`${TAB_LABELS[item].full} leaderboard lane`}
                  aria-controls={LEADERBOARD_ROWS_REGION_ID}
                  title={TAB_LABELS[item].full}
                >
                  <span className="lg:hidden">{TAB_LABELS[item].short}</span>
                  <span className="hidden lg:inline">{TAB_LABELS[item].full}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="text-sm font-medium text-cyan-100">
            {isBusy
              ? `Refreshing ${tab}...`
              : `Viewing ${tab}`}
          </p>
          {tab !== "Global" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handleTabChange("Global")}
              disabled={isBusy}
              aria-controls={LEADERBOARD_ROWS_REGION_ID}
              title="Return to Global lane"
            >
              Reset to Global
            </Button>
          ) : null}
        </div>
        {snapshot ? <p className="text-xs text-muted">{rows.length} ranked rows</p> : null}
      </section>
      {isLoading ? <LoadingState message="Loading leaderboard..." /> : null}
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
          eyebrow="Leaderboard participation"
          title="No public leaderboard rows yet"
          description="Rows appear after contributors complete OAuth, sync, and visibility."
          actionLabel="Open contributions"
          actionHref="/dashboard/contributions"
          analyticsTarget="leaderboard:no-live-rows"
        />
      ) : null}
      {!isLoading && !isError && snapshot && rows.length ? (
        <section id="leaderboard-arena" className="render-opt-section scroll-mt-24 space-y-4">
          <DeferUntilVisible fallback={<LeaderboardSectionPlaceholder title="Loading leaderboard arena" />}>
            {snapshot.currentUser ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-white">
                  Your arena mission: #{snapshot.currentUser.rank} in {tab} · {snapshot.currentUser.division}
                </h2>
                <GlowCard className="space-y-4 border border-cyan-300/22 bg-gradient-to-br from-slate-950/88 to-cyan-950/24">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-cyan-200">Your arena mission</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        #{snapshot.currentUser.rank} in {tab}
                      </h2>
                      <p className="mt-2 text-sm text-muted">Primary signal: {snapshot.currentUser.focus}</p>
                    </div>
                    <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
                      <Target className="h-3.5 w-3.5" />
                      {snapshot.currentUser.division}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted">
                      {snapshot.currentUser.xpToNextRank > 0
                        ? `${snapshot.currentUser.xpToNextRank} XP to next band`
                        : "You currently lead this lane"}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant={showMissionPlan ? "secondary" : "default"}
                      onClick={() => {
                        setShowMissionPlan((current) => !current);
                      }}
                      aria-expanded={showMissionPlan}
                      aria-controls="leaderboard-mission-plan"
                    >
                      {showMissionPlan ? "Hide mission plan" : "Show mission plan"}
                    </Button>
                  </div>
                  {showMissionPlan ? (
                    <div id="leaderboard-mission-plan" className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <ClimbTip
                          title="To next band"
                          body={
                            snapshot.currentUser.xpToNextRank > 0
                              ? `${snapshot.currentUser.xpToNextRank} XP required`
                              : "You are currently leading this lane"
                          }
                        />
                        <ClimbTip
                          title="Gap to lane leader"
                          body={laneGapToLeader > 0 ? `${laneGapToLeader} season XP` : "You currently hold lane lead"}
                        />
                        <ClimbTip
                          title="Current movement"
                          body={`${snapshot.currentUser.movement >= 0 ? "+" : ""}${snapshot.currentUser.movement} this cycle`}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted">
                          <span>Band progress</span>
                          <span>{currentUserProgressToNextBand}%</span>
                        </div>
                        <Progress value={currentUserProgressToNextBand} />
                      </div>
                    </div>
                  ) : (
                    <div id="leaderboard-mission-plan" className="neon-surface rounded-[1.1rem] border-dashed border-primary/24 px-4 py-3 text-xs text-muted">
                      Mission details are hidden by default for faster lane scanning.
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link href="/dashboard/contributions" prefetch={false}>
                        Improve contribution signal
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link href="/dashboard/quests" prefetch={false}>
                        Open tactical quests
                        <Trophy className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </GlowCard>
              </div>
            ) : null}
            <div id={LEADERBOARD_ROWS_REGION_ID}>
              <LeaderboardArena snapshot={snapshot} rowLimit={safeVisibleRowCount} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {hasMoreRows ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-controls={LEADERBOARD_ROWS_REGION_ID}
                  aria-label={`Show ${Math.min(rowPageSize, remainingRows)} more ranked rows. ${remainingRows} remaining.`}
                  onClick={() => {
                    startTransition(() => {
                      setVisibleRowCount((current) =>
                        Math.min(rows.length, current + rowPageSize),
                      );
                    });
                  }}
                >
                  Show more rows ({remainingRows} left)
                </Button>
              ) : null}
            </div>
          </DeferUntilVisible>
        </section>
      ) : null}
    </div>
  );
}

function LeaderboardSectionPlaceholder({ title }: { title: string }) {
  return (
    <GlowCard className="glass-panel cyber-card cyber-frame flex min-h-[11rem] items-center justify-center p-4">
      <p className="text-sm text-muted">{title}</p>
    </GlowCard>
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
      <p className="mt-1 text-xs text-muted">{body}</p>
    </div>
  );
}

function progressToNextBand(seasonXp: number, xpToNextRank: number): number {
  const gained = Math.max(0, seasonXp);
  const remaining = Math.max(0, xpToNextRank);
  const denominator = gained + remaining;
  if (denominator <= 0) {
    return 100;
  }
  return Math.max(0, Math.min(100, Math.round((gained / denominator) * 100)));
}
