"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useState } from "react";
import {
  BookText,
  CalendarClock,
  Cpu,
  FlaskConical,
  Globe2,
  TrendingUp,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { laneParamToTab, tabToLaneParam } from "@/features/leaderboard/lib/lane-param";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import type { LeaderboardTab } from "@/lib/api/leaderboard-api";
import { formatRelativeDays } from "@/lib/formatters";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";

const LeaderboardArena = dynamic(
  () =>
    import("@/features/leaderboard/components/LeaderboardArena").then(
      (mod) => mod.LeaderboardArena,
    ),
  {
    loading: () => <LeaderboardPanelPlaceholder label="Loading leaderboard rows" />,
  },
);

const tabs: LeaderboardTab[] = [
  "Global",
  "Backend",
  "Testing",
  "Documentation",
  "Weekly XP",
  "Rising Contributors",
];

const TAB_LABELS: Record<LeaderboardTab, string> = {
  Global: "Global",
  Backend: "Backend",
  Testing: "Testing",
  Documentation: "Documentation",
  "Weekly XP": "Weekly XP",
  "Rising Contributors": "Rising",
};

const TAB_ICONS: Record<LeaderboardTab, typeof Globe2> = {
  Global: Globe2,
  Backend: Cpu,
  Testing: FlaskConical,
  Documentation: BookText,
  "Weekly XP": CalendarClock,
  "Rising Contributors": TrendingUp,
};

const LEADERBOARD_ROW_PAGE_SIZE_DEFAULT = 12;
const LEADERBOARD_ROW_PAGE_SIZE_CONSTRAINED = 6;
const LEADERBOARD_ROWS_REGION_ID = "leaderboard-rows-region";
const LEADERBOARD_NEARBY_DEFAULT_THRESHOLD = 10;

export function LeaderboardPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const constrainedNetwork = useNetworkConstraintPreference();
  const rowPageSize = constrainedNetwork
    ? LEADERBOARD_ROW_PAGE_SIZE_CONSTRAINED
    : LEADERBOARD_ROW_PAGE_SIZE_DEFAULT;
  const [visibleRowCount, setVisibleRowCount] = useState(rowPageSize);
  const [showLaneDetails, setShowLaneDetails] = useState(false);
  const [preferNearbyMode, setPreferNearbyMode] = useState(true);
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
  const supportsNearbyMode =
    Boolean(snapshot?.currentUser) &&
    rows.length >= LEADERBOARD_NEARBY_DEFAULT_THRESHOLD;
  const effectiveMode: "nearby" | "full" =
    supportsNearbyMode && preferNearbyMode ? "nearby" : "full";

  function handleTabChange(value: string) {
    const nextTab = value as LeaderboardTab;
    const lane = tabToLaneParam(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("lane", lane);
    const query = nextParams.toString();
    startTransition(() => {
      setVisibleRowCount(rowPageSize);
      setPreferNearbyMode(true);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  const isBusy = isSwitchingTab || (isFetching && Boolean(snapshot));

  return (
    <div className="stable-scroll-scope space-y-6" aria-busy={isBusy || undefined}>
      <PageHeader
        eyebrow="Leaderboard"
        title="Leaderboard"
        description="Rank lanes and promotion progress."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Lane ${TAB_LABELS[tab]}` },
              { label: `Rows ${rows.length}` },
              { label: effectiveMode === "nearby" ? "View Nearby" : `Showing ${safeVisibleRowCount}` },
              {
                label: `Sync ${formatSyncStateLabel(myProfile?.user.syncStatus.state)}`,
                tone: toneForSyncState(myProfile?.user.syncStatus.state),
              },
            ]}
          />
        )}
        actions={(
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/quests" prefetch={false}>
              Quests
            </Link>
          </Button>
        )}
      />
      {myProfile?.user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Leaderboard context refreshed ${formatRelativeDays(
            myProfile.refreshedAt,
          )}. Rank updates can lag until sync completes.`}
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
      <section className="space-y-3">
        <div className="space-y-2">
          <p className="text-xs font-medium text-primary">Lane</p>
          <SegmentedTablist
            options={tabs.map((item) => {
              const Icon = TAB_ICONS[item];
              return {
                value: item,
                label: TAB_LABELS[item],
                icon: <Icon className="h-4 w-4" />,
                minWidthClassName: "min-w-[9rem]",
              };
            })}
            value={tab}
            onValueChange={handleTabChange}
            ariaLabel="Leaderboard lane filters"
            ariaControls={LEADERBOARD_ROWS_REGION_ID}
            className="w-full"
            tabIdPrefix="leaderboard-lane-tab"
            wrap
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p role="status" aria-live="polite" className="sr-only">
            {isBusy
              ? `Refreshing ${tab}...`
              : `Viewing ${tab}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowLaneDetails((current) => !current);
              }}
              aria-controls={LEADERBOARD_ROWS_REGION_ID}
              aria-pressed={showLaneDetails}
              title="Toggle additional lane details"
            >
              {showLaneDetails ? "Hide details" : "Show details"}
            </Button>
            {supportsNearbyMode ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPreferNearbyMode((current) => !current);
                }}
                aria-controls={LEADERBOARD_ROWS_REGION_ID}
                aria-pressed={effectiveMode === "nearby"}
              >
                {effectiveMode === "nearby" ? "Show full board" : "Show nearby view"}
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      {isLoading ? <LoadingState message="Loading leaderboard..." /> : null}
      {isError ? (
        <ErrorState
          title="Leaderboard unavailable"
          description="The ranking snapshot could not be refreshed. Retry or open dashboard."
          onRetry={() => {
            void refetch();
          }}
          fallbackLabel="Open dashboard"
          fallbackHref="/dashboard"
          analyticsTarget="leaderboard:error"
        />
      ) : null}
      {!isLoading && !isError && rows.length === 0 ? (
        <section className="space-y-4">
          <EmptyState
            eyebrow="Leaderboard participation"
            title="No leaderboard rows yet."
            description="Rows appear after contributors complete OAuth, sync, and visibility."
            actionLabel="Open contributions"
            actionHref="/dashboard/contributions"
            analyticsTarget="leaderboard:no-live-rows"
          />
          <GlowCard className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-primary">Arena preview</p>
              <p className="text-sm text-muted">
                Preview only. These bands explain progression rules and do not represent live user rows.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="neon-surface px-4 py-3">
                <p className="text-sm font-semibold text-white">Bronze ladder</p>
                <p className="mt-1 text-xs text-muted">Build first merged evidence and maintain weekly activity.</p>
              </div>
              <div className="neon-surface px-4 py-3">
                <p className="text-sm font-semibold text-white">Silver ladder</p>
                <p className="mt-1 text-xs text-muted">Sustain review-backed PR quality across multiple weeks.</p>
              </div>
              <div className="neon-surface px-4 py-3">
                <p className="text-sm font-semibold text-white">Gold+ ladder</p>
                <p className="mt-1 text-xs text-muted">High-impact merged work with consistent depth and reliability.</p>
              </div>
            </div>
            {myProfile?.user ? (
              <div className="neon-surface border border-primary/24 px-4 py-3">
                <p className="text-sm font-semibold text-white">
                  Your current tier: {myProfile.user.level.rankTier}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {myProfile.user.rankProgress.nextTier
                    ? `${myProfile.user.rankProgress.xpToNextTier.toLocaleString("en-US")} XP to ${myProfile.user.rankProgress.nextTier}.`
                    : "You are at the current top tier band."}
                </p>
              </div>
            ) : null}
          </GlowCard>
        </section>
      ) : null}
      {!isLoading && !isError && snapshot && rows.length ? (
        <section className="render-opt-section space-y-4">
          {snapshot.currentUser ? (
            <div className="neon-surface rounded-[1rem] px-4 py-3">
              <p className="text-sm font-semibold text-white">
                Rank #{snapshot.currentUser.rank} in {tab}
              </p>
              <p className="mt-1 text-xs text-muted">
                {snapshot.currentUser.xpToNextRank > 0
                  ? `${snapshot.currentUser.xpToNextRank} XP to next band`
                  : "You currently lead this lane"}
              </p>
            </div>
          ) : null}
          <div id={LEADERBOARD_ROWS_REGION_ID}>
            <LeaderboardArena
              snapshot={snapshot}
              rowLimit={effectiveMode === "full" ? safeVisibleRowCount : undefined}
              showDetails={showLaneDetails}
              viewMode={effectiveMode}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {effectiveMode === "full" && hasMoreRows ? (
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
        </section>
      ) : null}
    </div>
  );
}

function LeaderboardPanelPlaceholder({ label }: { label: string }) {
  return (
    <GlowCard className="min-h-[18rem] space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-9 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
