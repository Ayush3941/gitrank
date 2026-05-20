"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Target, Trophy } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConstrainedNetworkPill } from "@/components/shared/ConstrainedNetworkPill";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";
import { SectionJumpNav } from "@/components/shared/SectionJumpNav";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
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
import { initialSectionFromHash } from "@/lib/section-nav";

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

type LeaderboardSectionID =
  | "leaderboard-filters"
  | "leaderboard-arena"
  | "leaderboard-climb";

const LEADERBOARD_SECTION_ITEMS: Array<{ id: LeaderboardSectionID; label: string }> = [
  { id: "leaderboard-filters", label: "Tabs" },
  { id: "leaderboard-arena", label: "Arena" },
  { id: "leaderboard-climb", label: "Climb" },
];
const LEADERBOARD_SECTION_IDS = LEADERBOARD_SECTION_ITEMS.map(
  (section) => section.id,
) as LeaderboardSectionID[];
const LEADERBOARD_DEFAULT_SECTION: LeaderboardSectionID = "leaderboard-filters";
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
  const tabFromURL = laneParamToTab(searchParams.get("lane"));
  const tab = tabFromURL ?? "Global";
  const [activeSection, setActiveSection] =
    useState<LeaderboardSectionID>(LEADERBOARD_DEFAULT_SECTION);
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
  const sparseArena = !isLoading && !isError && !!snapshot && rows.length > 0 && rows.length < 5;
  const laneLeader = rows[0];
  const laneGapToLeader =
    snapshot?.currentUser && laneLeader
      ? Math.max(0, laneLeader.seasonXp - snapshot.currentUser.seasonXp)
      : 0;
  const laneSharePath = `/dashboard/leaderboard?lane=${tabToLaneParam(tab)}`;
  const currentUserProgressToNextBand = snapshot?.currentUser
    ? progressToNextBand(snapshot.currentUser.seasonXp, snapshot.currentUser.xpToNextRank)
    : 0;
  const activeSectionLabel =
    LEADERBOARD_SECTION_ITEMS.find((section) => section.id === activeSection)?.label ??
    "Tabs";
  const activeSectionLink =
    `/dashboard/leaderboard?lane=${tabToLaneParam(tab)}#${activeSection}`;

  useEffect(() => {
    const lane = tabToLaneParam(tab);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextParams.get("lane") === lane) {
      return;
    }
    nextParams.set("lane", lane);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, tab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      const nextSection = initialSectionFromHash(
        LEADERBOARD_SECTION_IDS,
        LEADERBOARD_DEFAULT_SECTION,
        window.location.hash,
      );
      setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const nextSection = initialSectionFromHash(
          LEADERBOARD_SECTION_IDS,
          LEADERBOARD_DEFAULT_SECTION,
          `#${visible.target.id}`,
        );
        setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    LEADERBOARD_SECTION_ITEMS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      observer.disconnect();
    };
  }, []);

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
        title="Leaderboard arena"
        description="A time-windowed ranking snapshot weighted by meaningful merged work, review depth, tests, and project context."
        meta={
          <>
            <SnapshotFreshnessPill
              refreshedAt={myProfile?.refreshedAt}
              label="Leaderboard context"
            />
            <ConstrainedNetworkPill />
          </>
        }
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/contributions">Open contributions</Link>
          </Button>
        )}
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
          )}. Rank movement can lag until the next profile sync completes.`}
          updatedAt={myProfile.refreshedAt}
          onRefresh={() => {
            void refetchMyProfile();
            void refetch();
          }}
          isRefreshing={isFetching || isFetchingMyProfile}
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="leaderboard:stale"
        />
      ) : null}
      <SectionJumpNav
        navLabelID="leaderboard-jump-nav-label"
        landmarkLabel="Leaderboard section navigation"
        activeSectionLabel={activeSectionLabel}
        items={LEADERBOARD_SECTION_ITEMS}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
        copyHref={activeSectionLink}
        copyAnalyticsTarget="leaderboard/copy-section-link"
      />
      <section id="leaderboard-filters" className="scroll-mt-24 space-y-3">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList
            className="scrollbar-thin w-full overflow-x-auto whitespace-nowrap"
            aria-label="Leaderboard lane filters"
          >
            {tabs.map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                aria-label={`${TAB_LABELS[item].full} leaderboard lane`}
                title={TAB_LABELS[item].full}
              >
                <span className="sm:hidden">{TAB_LABELS[item].short}</span>
                <span className="hidden sm:inline">{TAB_LABELS[item].full}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="text-sm font-medium text-cyan-100">
            {isBusy
              ? `Refreshing ${tab} snapshot...`
              : `Viewing ${tab} snapshot`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {tab !== "Global" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleTabChange("Global")}
                disabled={isBusy}
                title="Return to Global lane"
              >
                Reset to Global
              </Button>
            ) : null}
            <CopyLinkButton
              href={laneSharePath}
              label="Copy lane link"
              copiedLabel="Lane link copied"
              analyticsTarget="leaderboard/copy-lane-link"
            />
          </div>
        </div>
        {snapshot ? (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
              {rows.length} active rows
            </span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
              Window {snapshot.season.windowLabel}
            </span>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
              Formula {snapshot.season.scoringVersion}
            </span>
          </div>
        ) : null}
        <div className="neon-callout rounded-[1.75rem] px-4 py-3 text-sm text-muted">
          Snapshot note: leaderboard placement is directional, not a final measure of engineering ability. Quality weighting reduces the impact of shallow, unreviewed, or repetitive PR floods.
        </div>
      </section>
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
        <div className="space-y-4">
          <EmptyState
            eyebrow="Leaderboard participation"
            title="No public leaderboard rows yet"
            description="GitRank does not fabricate leaderboard identities. Rows appear only after contributors complete OAuth, sync, and enable public participation."
            actionLabel="Open contributions"
            actionHref="/dashboard/contributions"
            analyticsTarget="leaderboard:no-live-rows"
          />
          <GlowCard className="space-y-4 border border-primary/20 bg-gradient-to-br from-slate-950/90 to-cyan-950/20">
            <div>
              <p className="text-xs font-medium text-primary">Arena preview state</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">How ranking unlocks</h2>
              <p className="mt-2 text-sm text-muted">
                When public participants are present, GitRank places profiles into weekly rank bands using score evidence quality, consistency, and merged impact.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <ClimbTip title="Band 1" body="Bronze I to Silver II: establish verified merged contribution cadence." />
              <ClimbTip title="Band 2" body="Gold III: maintain review depth and stronger weekly impact signals." />
              <ClimbTip title="Band 3" body="Platinum and above: sustain high-signal quality while avoiding spam caps." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/settings">Sync and enable profile visibility</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard/quests">Open quest lane</Link>
              </Button>
            </div>
          </GlowCard>
        </div>
      ) : null}
      {!isLoading && !isError && snapshot && rows.length ? (
        <section id="leaderboard-arena" className="render-opt-section scroll-mt-24 space-y-4">
          <DeferUntilVisible fallback={<LeaderboardSectionPlaceholder title="Loading leaderboard arena" />}>
            {snapshot.currentUser ? (
              <GlowCard className="space-y-4 border border-cyan-300/22 bg-gradient-to-br from-slate-950/88 to-cyan-950/24">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-cyan-200">Your arena mission</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      #{snapshot.currentUser.rank} in {tab}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      Focus lane: {snapshot.currentUser.focus}. Keep quality-weighted merged evidence flowing to move bands safely.
                    </p>
                  </div>
                  <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
                    <Target className="h-3.5 w-3.5" />
                    {snapshot.currentUser.division}
                  </span>
                </div>
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
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/dashboard/contributions">
                      Improve contribution signal
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/dashboard/quests">
                      Open tactical quests
                      <Trophy className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </GlowCard>
            ) : null}
            <div id={LEADERBOARD_ROWS_REGION_ID}>
              <LeaderboardArena snapshot={snapshot} rowLimit={safeVisibleRowCount} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
                Showing {safeVisibleRowCount} of {rows.length} ranked rows.
              </p>
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
            <GlowCard id="leaderboard-climb" className="scroll-mt-24 space-y-3 border border-fuchsia-300/22 bg-gradient-to-br from-slate-950/90 to-fuchsia-950/20">
              <p className="text-xs font-medium text-fuchsia-200">How to climb</p>
              <div className="grid gap-3 md:grid-cols-3">
                <ClimbTip title="Raise review depth" body="Address maintainer feedback loops quickly; review quality raises signal trust." />
                <ClimbTip title="Increase weekly impact" body="Prefer merged changes with measurable scope over low-signal micro churn." />
                <ClimbTip title="Preserve streak cadence" body="Consistent weekly evidence improves movement and reduces demotion risk." />
              </div>
            </GlowCard>
          </DeferUntilVisible>
        </section>
      ) : null}
      {sparseArena && snapshot ? (
        <GlowCard className="space-y-4 border border-amber-400/24 bg-amber-400/8">
          <div>
            <p className="text-xs font-medium text-amber-100">Arena preview mode</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Live competition is still warming up</h2>
            <p className="mt-2 readable-measure text-sm leading-7 text-amber-50">
              This lane has {rows.length} active public profiles right now. Ranking is live, but bracket density is still low.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ClimbTip
              title="Your current slot"
              body={
                snapshot.currentUser
                  ? `#${snapshot.currentUser.rank} in ${tab}`
                  : "Unranked in this lane"
              }
            />
            <ClimbTip
              title="Promotion target"
              body={snapshot.currentUser ? `${snapshot.currentUser.xpToNextRank} XP to next band` : "Sync more evidence to enter rank bands"}
            />
            <ClimbTip
              title="Fastest climb lane"
              body="Prioritize merged PR depth, review quality, and weekly consistency over raw volume."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/contributions">Improve contribution signal</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/quests">Open quest lane</Link>
            </Button>
          </div>
        </GlowCard>
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
