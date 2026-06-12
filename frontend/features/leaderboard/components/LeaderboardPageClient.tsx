"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { GlowCard } from "@/components/shared/GlowCard";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import {
  LeaderboardControls,
  LEADERBOARD_TAB_LABELS,
} from "@/features/leaderboard/components/LeaderboardControls";
import { laneParamToTab, tabToLaneParam } from "@/features/leaderboard/lib/lane-param";
import {
  buildLeaderboardPageModel,
  resolveLeaderboardRowPageSize,
} from "@/features/leaderboard/lib/leaderboard-view-model";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import { useMyProfile } from "@/hooks/use-profile";
import type { LeaderboardTab } from "@/lib/api/leaderboard-api";
import { formatPluralCount, formatXpLabel } from "@/lib/formatters";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
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

const LEADERBOARD_SECTION_LINKS = [
  { id: "leaderboard-controls", label: "Controls" },
  { id: "leaderboard-arena", label: "Arena" },
];

export function LeaderboardPageClient() {
  const leaderboardRowsRegionId = useId();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const constrainedNetwork = useNetworkConstraintPreference();
  const runUserSync = useRunUserSync();
  const syncRunsQuery = useProfileSyncRuns();
  const rowPageSize = resolveLeaderboardRowPageSize(constrainedNetwork);
  const [visibleRowCount, setVisibleRowCount] = useState(rowPageSize);
  const [showLaneDetails, setShowLaneDetails] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [preferNearbyMode, setPreferNearbyMode] = useState(true);
  const leaderboardViewOptionsToggleId = useId();
  const leaderboardViewOptionsRegionId = useId();
  const tabFromURL = laneParamToTab(searchParams.get("lane"));
  const tab = tabFromURL ?? "Global";
  const deferredTab = useDeferredValue(tab);
  const { data, isLoading, isError, isFetching, refetch } = useLeaderboard(deferredTab);
  const {
    data: myProfile,
    refetch: refetchMyProfile,
  } = useMyProfile();
  const { syncStateForDisplay, showRefreshPill } = useProfileSyncState(
    myProfile?.user,
    syncRunsQuery.data?.runs,
  );
  const latestSyncOutcome = useMemo(
    () => selectLatestActionableSyncRunOutcome(syncRunsQuery.data?.runs),
    [syncRunsQuery.data?.runs],
  );
  const appInstallationBlocked = isGitHubAppInstallationBlocked(latestSyncOutcome);
  const displaySyncState = appInstallationBlocked ? "failed" : syncStateForDisplay;
  const isSwitchingTab = deferredTab !== tab;
  const currentUsername = myProfile?.user.username;
  const profileRefreshedAt = myProfile?.refreshedAt;
  const hasProfile = Boolean(myProfile);
  const leaderboardModel = useMemo(
    () =>
      buildLeaderboardPageModel({
        snapshot: data,
        currentUsername,
        tab,
        visibleRowCount,
        constrainedNetwork,
        preferNearbyMode,
        showLaneDetails,
        displaySyncState,
        latestSyncOutcome,
        profileRefreshedAt,
        hasProfile,
        isSwitchingTab,
        isFetching,
      }),
    [
      constrainedNetwork,
      data,
      displaySyncState,
      currentUsername,
      hasProfile,
      isFetching,
      isSwitchingTab,
      latestSyncOutcome,
      profileRefreshedAt,
      preferNearbyMode,
      showLaneDetails,
      tab,
      visibleRowCount,
    ],
  );
  const nextRowBatchLabel = formatPluralCount(
    Math.min(leaderboardModel.rowPageSize, leaderboardModel.remainingRows),
    "ranked row",
  );
  const remainingRowLabel = formatPluralCount(
    leaderboardModel.remainingRows,
    "ranked row",
  );
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(undefined),
    refetchAfterSync: async () => {
      await Promise.allSettled([refetchMyProfile(), refetch()]);
    },
  });
  function replaceLane(nextTab: LeaderboardTab) {
    const lane = tabToLaneParam(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("lane", lane);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleTabChange(nextTab: LeaderboardTab) {
    startTransition(() => {
      setVisibleRowCount(rowPageSize);
      setPreferNearbyMode(true);
      replaceLane(nextTab);
    });
  }

  return (
    <div
      className="stable-scroll-scope space-y-6"
      aria-busy={leaderboardModel.isBusy || undefined}
    >
      <PageHeader
        eyebrow="Leaderboard"
        title="Leaderboard"
        description="Rank lanes and promotion progress."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Lane ${LEADERBOARD_TAB_LABELS[tab]}` },
              {
                label: `Sync ${formatSyncStateLabel(displaySyncState)}`,
                tone: toneForSyncState(displaySyncState),
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ProfileEvidenceStateChip
              showFreshness={shouldShowProfileFreshnessPill(
                showRefreshPill,
                displaySyncState,
                appInstallationBlocked,
              )}
              refreshedAt={myProfile?.refreshedAt}
              syncState={displaySyncState}
            />
            <Button asChild variant="secondary" size="sm">
              <IntentPrefetchLink href="/dashboard/quests">
                Quests
              </IntentPrefetchLink>
            </Button>
          </div>
        )}
      />
      {appInstallationBlocked ? (
        <GitHubAppSyncBlockNotice message={latestSyncOutcome?.message} />
      ) : null}
      {leaderboardModel.shouldShowStaleState && myProfile ? (
        <StaleState
          message={leaderboardModel.staleNotice.message}
          reasonMessage={leaderboardModel.staleNotice.reasonMessage}
          updatedAt={myProfile.refreshedAt}
          syncState={displaySyncState === "partially_synced" ? "partially_synced" : "stale"}
          onRefresh={staleSyncRefresh.onRefresh}
          isRefreshing={staleSyncRefresh.isRefreshing}
          refreshLabel={staleSyncRefresh.refreshLabel}
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="leaderboard:stale"
        />
      ) : null}
      <InPageSectionNav sections={LEADERBOARD_SECTION_LINKS} className="render-opt-section" />
      <LeaderboardControls
        rowsCount={leaderboardModel.rows.length}
        tab={tab}
        isBusy={leaderboardModel.isBusy}
        activeFilterCount={leaderboardModel.activeFilterCount}
        hasViewFilter={leaderboardModel.hasViewFilter}
        showLaneDetails={showLaneDetails}
        canClearAllControls={leaderboardModel.canClearAllControls}
        rowsRegionId={leaderboardRowsRegionId}
        viewOptionsToggleId={leaderboardViewOptionsToggleId}
        viewOptionsRegionId={leaderboardViewOptionsRegionId}
        showViewOptions={showViewOptions}
        supportsNearbyMode={leaderboardModel.supportsNearbyMode}
        effectiveMode={leaderboardModel.effectiveMode}
        onReset={() => {
          startTransition(() => {
            setShowLaneDetails(false);
            setPreferNearbyMode(true);
            setVisibleRowCount(rowPageSize);
            replaceLane("Global");
          });
        }}
        onTabChange={handleTabChange}
        onToggleViewOptions={() => {
          setShowViewOptions((current) => !current);
        }}
        onToggleLaneDetails={() => {
          setShowLaneDetails((current) => !current);
        }}
        onToggleNearbyMode={() => {
          setPreferNearbyMode((current) => !current);
        }}
      />
      {isLoading ? <LoadingState message="Leaderboard rows" /> : null}
      {isError ? (
        <ErrorState
          title="Leaderboard unavailable"
          description="The ranking snapshot is unavailable right now. Retry or open dashboard."
          onRetry={() => {
            void refetch();
          }}
          fallbackLabel="Open dashboard"
          fallbackHref="/dashboard"
          analyticsTarget="leaderboard:error"
        />
      ) : null}
      <section id="leaderboard-arena" data-scroll-target="true" className="render-opt-section space-y-4">
        {!isLoading && !isError && leaderboardModel.rows.length === 0 ? (
          <>
            <EmptyState
              eyebrow="Leaderboard participation"
              title="Leaderboard needs visible scored profiles"
              description="Rows appear after contributors sync scored PR evidence and keep leaderboard participation visible."
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
                      ? `${formatXpLabel(myProfile.user.rankProgress.xpToNextTier)} to ${myProfile.user.rankProgress.nextTier}.`
                      : "You are at the current top tier band."}
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <IntentPrefetchLink href="/dashboard/contributions">
                    Open contributions
                  </IntentPrefetchLink>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <IntentPrefetchLink href="/dashboard/settings">
                    Open sync settings
                  </IntentPrefetchLink>
                </Button>
              </div>
            </GlowCard>
          </>
        ) : null}
        {!isLoading && !isError && leaderboardModel.snapshot && leaderboardModel.rows.length ? (
          <>
            {leaderboardModel.snapshot.currentUser ? (
              <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
                <p className="text-sm font-semibold text-white">
                  Rank #{leaderboardModel.snapshot.currentUser.rank} in {tab}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {leaderboardModel.snapshot.currentUser.xpToNextRank > 0
                    ? `${formatXpLabel(leaderboardModel.snapshot.currentUser.xpToNextRank)} to next band`
                    : "You currently lead this lane"}
                </p>
              </div>
            ) : null}
            <div id={leaderboardRowsRegionId} data-leaderboard-arena="true">
              <LeaderboardArena
                snapshot={leaderboardModel.snapshot}
                rowLimit={
                  leaderboardModel.effectiveMode === "full"
                    ? leaderboardModel.safeVisibleRowCount
                    : undefined
                }
                showDetails={showLaneDetails}
                viewMode={leaderboardModel.effectiveMode}
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {leaderboardModel.effectiveMode === "full" && leaderboardModel.hasMoreRows ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-controls={leaderboardRowsRegionId}
                  aria-label={`Show ${nextRowBatchLabel}. ${remainingRowLabel} remaining.`}
                  onClick={() => {
                    startTransition(() => {
                      setVisibleRowCount((current) =>
                        Math.min(
                          leaderboardModel.rows.length,
                          current + leaderboardModel.rowPageSize,
                        ),
                      );
                    });
                  }}
                >
                  Show more rows ({remainingRowLabel} left)
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function LeaderboardPanelPlaceholder({ label }: { label: string }) {
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
