"use client";

import { startTransition, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { BadgesLockedPathsSection } from "@/features/badges/components/BadgesLockedPathsSection";
import { BadgesOverviewCard } from "@/features/badges/components/BadgesOverviewCard";
import { BadgesShelfControls } from "@/features/badges/components/BadgesShelfControls";
import { BadgesShelfResults } from "@/features/badges/components/BadgesShelfResults";
import {
  buildBadgeFilterState,
  buildBadgeShelfModel,
  type BadgeRarityFilter,
  type BadgeVisibilityFilter,
} from "@/features/badges/lib/badge-shelf-model";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useBadges } from "@/hooks/use-badges";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import {
  deriveDeterministicArchetype,
} from "@/lib/ai/deterministic-identity-summary";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
const LOCKED_BADGE_PAGE_SIZE_DEFAULT = 8;
const LOCKED_BADGE_PAGE_SIZE_CONSTRAINED = 4;
const BADGE_SHELF_PAGE_SIZE_DEFAULT = 10;
const BADGE_SHELF_PAGE_SIZE_CONSTRAINED = 6;
const BADGES_SECTION_LINKS = [
  { id: "badges-overview", label: "Overview" },
  { id: "badges-shelf", label: "Shelf" },
  { id: "badges-locked", label: "Locked paths" },
];

export function BadgesPageClient() {
  const { data, isLoading, isError, refetch } = useBadges();
  const runUserSync = useRunUserSync();
  const syncRunsQuery = useProfileSyncRuns();
  const constrainedNetwork = useNetworkConstraintPreference();
  const lockedBadgePageSize = constrainedNetwork
    ? LOCKED_BADGE_PAGE_SIZE_CONSTRAINED
    : LOCKED_BADGE_PAGE_SIZE_DEFAULT;
  const badgeShelfPageSize = constrainedNetwork
    ? BADGE_SHELF_PAGE_SIZE_CONSTRAINED
    : BADGE_SHELF_PAGE_SIZE_DEFAULT;
  const badgeViewedEventSent = useRef(false);
  const previousUnlockedCountRef = useRef<number | null>(null);
  const [rarity, setRarity] = useState<BadgeRarityFilter>("All");
  const [visibility, setVisibility] = useState<BadgeVisibilityFilter>("All");
  const deferredRarity = useDeferredValue(rarity);
  const deferredVisibility = useDeferredValue(visibility);
  const [unlockNotice, setUnlockNotice] = useState("");
  const [visibleLockedCount, setVisibleLockedCount] = useState(lockedBadgePageSize);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState(badgeShelfPageSize);
  const [showLockedBadges, setShowLockedBadges] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const badgesEarnedRegionId = useId();
  const badgesLockedRegionId = useId();
  const badgesLockedToggleId = useId();
  const badgesFilterStatusId = useId();
  const badgesAdvancedFiltersToggleId = useId();
  const badgesAdvancedFiltersRegionId = useId();
  const isFiltering = deferredRarity !== rarity || deferredVisibility !== visibility;
  const filterState = buildBadgeFilterState({ rarity, visibility });
  const badgeShelf = useMemo(
    () =>
      buildBadgeShelfModel({
        badges: data?.badges ?? [],
        rarity: deferredRarity,
        visibility: deferredVisibility,
        visibleBadgeCount,
        visibleLockedCount,
      }),
    [
      data?.badges,
      deferredRarity,
      deferredVisibility,
      visibleBadgeCount,
      visibleLockedCount,
    ],
  );
  const profile = data?.profile;
  const { syncStateForDisplay, showRefreshPill } = useProfileSyncState(
    profile?.user,
    syncRunsQuery.data?.runs,
  );
  const latestSyncOutcome = useMemo(
    () => selectLatestActionableSyncRunOutcome(syncRunsQuery.data?.runs),
    [syncRunsQuery.data?.runs],
  );
  const appInstallationBlocked = isGitHubAppInstallationBlocked(latestSyncOutcome);
  const displaySyncState = appInstallationBlocked ? "failed" : syncStateForDisplay;
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(undefined),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const staleNotice = useMemo(
    () =>
      buildStaleSyncNotice({
        syncState: displaySyncState === "partially_synced" ? "partially_synced" : "stale",
        refreshedAt: profile?.refreshedAt,
        latestSyncOutcome,
        snapshotLabel: "Badge snapshot",
        partialFallback:
          "Badge snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
        staleFallback:
          "New unlocks can appear after the next completed sync.",
      }),
    [displaySyncState, latestSyncOutcome, profile?.refreshedAt],
  );
  const streak = summarizeContributionStreak(profile?.user.contributions ?? []);

  const abraPayload = useMemo(
    () =>
      buildAbraInsightsRequest({
        user: profile?.user,
        contributions: profile?.user.contributions ?? [],
        badges: badgeShelf.filtered,
        repositoriesTouched: profile?.topRepositories.length ?? 0,
        streakDays: streak.currentStreakDays,
        enabled: !constrainedNetwork,
        badgeLimit: 10,
        badgeCount: badgeShelf.unlockedCount,
      }),
    [
      badgeShelf.filtered,
      badgeShelf.unlockedCount,
      constrainedNetwork,
      profile?.topRepositories.length,
      profile?.user,
      streak.currentStreakDays,
    ],
  );
  const abraInsights = useAbraInsights(abraPayload);
  const fallbackArchetype = profile
    ? deriveDeterministicArchetype(profile.user.strongestSignals)
    : "Systems Builder";

  useEffect(() => {
    if (isLoading || isError || !data || badgeViewedEventSent.current) {
      return;
    }
    badgeViewedEventSent.current = true;
    void emitAnalyticsEvent({
      eventName: "badge.viewed",
      source: "frontend",
      target: "dashboard/badges",
      status: "success",
    });
  }, [data, isError, isLoading]);

  useEffect(() => {
    if (isLoading || isError || !data) {
      return;
    }
    const previous = previousUnlockedCountRef.current;
    previousUnlockedCountRef.current = badgeShelf.unlockedCount;
    if (previous === null || badgeShelf.unlockedCount <= previous) {
      return;
    }
    const delta = badgeShelf.unlockedCount - previous;
    setUnlockNotice(
      delta === 1
        ? "Badge unlocked. Your shelf gained 1 new achievement."
        : `Badges unlocked. Your shelf gained ${delta} new achievements.`,
    );
  }, [badgeShelf.unlockedCount, data, isError, isLoading]);

  useEffect(() => {
    if (!unlockNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setUnlockNotice("");
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [unlockNotice]);

  function handleRarityChange(value: BadgeRarityFilter) {
    startTransition(() => {
      setRarity(value);
      setVisibleLockedCount(lockedBadgePageSize);
      setVisibleBadgeCount(badgeShelfPageSize);
    });
  }

  function handleVisibilityChange(value: BadgeVisibilityFilter) {
    startTransition(() => {
      setVisibility(value);
      setVisibleLockedCount(lockedBadgePageSize);
      setVisibleBadgeCount(badgeShelfPageSize);
    });
  }

  function handleResetFilters() {
    startTransition(() => {
      setRarity("All");
      setVisibility("All");
      setVisibleLockedCount(lockedBadgePageSize);
      setVisibleBadgeCount(badgeShelfPageSize);
    });
  }

  return (
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Badges"
        title="Badges"
        description="Achievements and next unlocks."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Earned ${badgeShelf.unlockedCount}` },
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
              showFreshness={shouldShowProfileFreshnessPill(showRefreshPill, displaySyncState, appInstallationBlocked)}
              refreshedAt={profile?.refreshedAt}
              syncState={displaySyncState}
            />
            <Button asChild variant="secondary" size="sm">
              <IntentPrefetchLink href="/dashboard/contributions">
                Contributions
              </IntentPrefetchLink>
            </Button>
          </div>
        )}
      />
      <InPageSectionNav sections={BADGES_SECTION_LINKS} className="render-opt-section" />
      <section
        id="badges-overview"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
      >
        {appInstallationBlocked ? (
          <GitHubAppSyncBlockNotice message={latestSyncOutcome?.message} />
        ) : null}
        {profile && (displaySyncState === "stale" || displaySyncState === "partially_synced") ? (
          <StaleState
            message={staleNotice.message}
            reasonMessage={staleNotice.reasonMessage}
            updatedAt={profile.refreshedAt}
            syncState={displaySyncState === "partially_synced" ? "partially_synced" : "stale"}
            onRefresh={staleSyncRefresh.onRefresh}
            isRefreshing={staleSyncRefresh.isRefreshing}
            refreshLabel={staleSyncRefresh.refreshLabel}
            actionLabel="Open sync settings"
            actionHref="/dashboard/settings"
            analyticsTarget="badges:stale"
          />
        ) : null}
        {!isLoading && !isError && profile ? (
          <BadgesOverviewCard
            archetype={abraInsights.data?.archetype ?? fallbackArchetype}
            identitySummary={
              abraInsights.data?.identitySummary ||
              "Using deterministic badge guidance right now."
            }
            unlockedCount={badgeShelf.unlockedCount}
            completionPercent={badgeShelf.completionPercent}
            level={profile.user.level.currentLevel}
            streakDays={streak.currentStreakDays}
            unlockNotice={unlockNotice}
            nextUnlockTarget={badgeShelf.nextUnlockTarget}
            onDismissUnlockNotice={() => {
              setUnlockNotice("");
            }}
          />
        ) : null}
      </section>
      <section
        id="badges-shelf"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
      >
        <BadgesShelfControls
          filteredCount={badgeShelf.filtered.length}
          totalCount={badgeShelf.totalCount}
          unlockedCount={badgeShelf.unlockedCount}
          isFiltering={isFiltering}
          activeFilterCount={filterState.activeFilterCount}
          canResetFilters={filterState.canResetFilters}
          filterStatusId={badgesFilterStatusId}
          earnedRegionId={badgesEarnedRegionId}
          advancedFiltersToggleId={badgesAdvancedFiltersToggleId}
          advancedFiltersRegionId={badgesAdvancedFiltersRegionId}
          visibility={visibility}
          rarity={rarity}
          showAdvancedFilters={showAdvancedFilters}
          onVisibilityChange={handleVisibilityChange}
          onRarityChange={handleRarityChange}
          onResetFilters={handleResetFilters}
          onToggleAdvancedFilters={() => {
            setShowAdvancedFilters((current) => !current);
          }}
        />
        <div id={badgesEarnedRegionId}>
          <BadgesShelfResults
            visibleBadges={badgeShelf.visibleBadges}
            stories={abraInsights.data?.badgeStories}
            isLoading={isLoading}
            isError={isError}
            filteredCount={badgeShelf.filtered.length}
            totalCount={badgeShelf.totalCount}
            canResetFilters={filterState.canResetFilters}
            hasMoreBadges={badgeShelf.hasMoreBadges}
            remainingBadges={badgeShelf.remainingBadges}
            regionId={badgesEarnedRegionId}
            onRetry={() => {
              void refetch();
            }}
            onResetFilters={handleResetFilters}
            onShowMoreBadges={() => {
              startTransition(() => {
                setVisibleBadgeCount((current) =>
                  Math.min(badgeShelf.filtered.length, current + badgeShelfPageSize),
                );
              });
            }}
          />
        </div>
      </section>
      <BadgesLockedPathsSection
        lockedBadges={badgeShelf.lockedBadges}
        lockedBadgePreview={badgeShelf.lockedBadgePreview}
        visibleLockedBadges={badgeShelf.visibleLockedBadges}
        hasMoreLockedBadges={badgeShelf.hasMoreLockedBadges}
        remainingLockedBadges={badgeShelf.remainingLockedBadges}
        showLockedBadges={showLockedBadges}
        isLoading={isLoading}
        isError={isError}
        regionId={badgesLockedRegionId}
        toggleId={badgesLockedToggleId}
        onToggleLockedBadges={() => {
          setShowLockedBadges((current) => !current);
        }}
        onShowMoreLockedBadges={() => {
          startTransition(() => {
            setVisibleLockedCount((current) =>
              Math.min(badgeShelf.lockedBadgesSorted.length, current + lockedBadgePageSize),
            );
          });
        }}
      />
    </div>
  );
}
