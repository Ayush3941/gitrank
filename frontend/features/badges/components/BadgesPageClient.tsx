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
  type BadgeRarityFilter,
  type BadgeVisibilityFilter,
} from "@/features/badges/lib/badge-shelf-model";
import {
  buildBadgesPageModel,
  resolveBadgePageSizes,
} from "@/features/badges/lib/badges-page-model";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useBadges } from "@/hooks/use-badges";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";

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
  const pageSizes = resolveBadgePageSizes(constrainedNetwork);
  const badgeViewedEventSent = useRef(false);
  const previousUnlockedCountRef = useRef<number | null>(null);
  const [rarity, setRarity] = useState<BadgeRarityFilter>("All");
  const [visibility, setVisibility] = useState<BadgeVisibilityFilter>("All");
  const deferredRarity = useDeferredValue(rarity);
  const deferredVisibility = useDeferredValue(visibility);
  const [unlockNotice, setUnlockNotice] = useState("");
  const [visibleLockedCount, setVisibleLockedCount] = useState(pageSizes.lockedBadgePageSize);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState(pageSizes.badgeShelfPageSize);
  const [showLockedBadges, setShowLockedBadges] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const badgesEarnedRegionId = useId();
  const badgesLockedRegionId = useId();
  const badgesLockedToggleId = useId();
  const badgesFilterStatusId = useId();
  const badgesAdvancedFiltersToggleId = useId();
  const badgesAdvancedFiltersRegionId = useId();
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
  const badgePage = useMemo(
    () =>
      buildBadgesPageModel({
        badges: data?.badges ?? [],
        profile,
        rarity,
        visibility,
        deferredRarity,
        deferredVisibility,
        visibleBadgeCount,
        visibleLockedCount,
        constrainedNetwork,
        displaySyncState,
        latestSyncOutcome,
      }),
    [
      data?.badges,
      constrainedNetwork,
      deferredRarity,
      deferredVisibility,
      displaySyncState,
      latestSyncOutcome,
      profile,
      rarity,
      visibleBadgeCount,
      visibleLockedCount,
      visibility,
    ],
  );
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(undefined),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const abraInsights = useAbraInsights(badgePage.abraPayload);

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
    previousUnlockedCountRef.current = badgePage.badgeShelf.unlockedCount;
    if (previous === null || badgePage.badgeShelf.unlockedCount <= previous) {
      return;
    }
    const delta = badgePage.badgeShelf.unlockedCount - previous;
    setUnlockNotice(
      delta === 1
        ? "Badge unlocked. Your shelf gained 1 new achievement."
        : `Badges unlocked. Your shelf gained ${delta} new achievements.`,
    );
  }, [badgePage.badgeShelf.unlockedCount, data, isError, isLoading]);

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
      setVisibleLockedCount(badgePage.pageSizes.lockedBadgePageSize);
      setVisibleBadgeCount(badgePage.pageSizes.badgeShelfPageSize);
    });
  }

  function handleVisibilityChange(value: BadgeVisibilityFilter) {
    startTransition(() => {
      setVisibility(value);
      setVisibleLockedCount(badgePage.pageSizes.lockedBadgePageSize);
      setVisibleBadgeCount(badgePage.pageSizes.badgeShelfPageSize);
    });
  }

  function handleResetFilters() {
    startTransition(() => {
      setRarity("All");
      setVisibility("All");
      setVisibleLockedCount(badgePage.pageSizes.lockedBadgePageSize);
      setVisibleBadgeCount(badgePage.pageSizes.badgeShelfPageSize);
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
              { label: `Earned ${badgePage.badgeShelf.unlockedCount}` },
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
        {badgePage.shouldShowStaleState && profile ? (
          <StaleState
            message={badgePage.staleNotice.message}
            reasonMessage={badgePage.staleNotice.reasonMessage}
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
            archetype={abraInsights.data?.archetype ?? badgePage.fallbackArchetype}
            identitySummary={
              abraInsights.data?.identitySummary ||
              "Using deterministic badge guidance right now."
            }
            unlockedCount={badgePage.badgeShelf.unlockedCount}
            completionPercent={badgePage.badgeShelf.completionPercent}
            level={profile.user.level.currentLevel}
            streakDays={badgePage.streak.currentStreakDays}
            unlockNotice={unlockNotice}
            nextUnlockTarget={badgePage.badgeShelf.nextUnlockTarget}
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
          filteredCount={badgePage.badgeShelf.filtered.length}
          totalCount={badgePage.badgeShelf.totalCount}
          unlockedCount={badgePage.badgeShelf.unlockedCount}
          isFiltering={badgePage.isFiltering}
          activeFilterCount={badgePage.filterState.activeFilterCount}
          canResetFilters={badgePage.filterState.canResetFilters}
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
            visibleBadges={badgePage.badgeShelf.visibleBadges}
            stories={abraInsights.data?.badgeStories}
            isLoading={isLoading}
            isError={isError}
            filteredCount={badgePage.badgeShelf.filtered.length}
            totalCount={badgePage.badgeShelf.totalCount}
            canResetFilters={badgePage.filterState.canResetFilters}
            hasMoreBadges={badgePage.badgeShelf.hasMoreBadges}
            remainingBadges={badgePage.badgeShelf.remainingBadges}
            regionId={badgesEarnedRegionId}
            onRetry={() => {
              void refetch();
            }}
            onResetFilters={handleResetFilters}
            onShowMoreBadges={() => {
              startTransition(() => {
                setVisibleBadgeCount((current) =>
                  Math.min(
                    badgePage.badgeShelf.filtered.length,
                    current + badgePage.pageSizes.badgeShelfPageSize,
                  ),
                );
              });
            }}
          />
        </div>
      </section>
      <BadgesLockedPathsSection
        lockedBadges={badgePage.badgeShelf.lockedBadges}
        lockedBadgePreview={badgePage.badgeShelf.lockedBadgePreview}
        visibleLockedBadges={badgePage.badgeShelf.visibleLockedBadges}
        hasMoreLockedBadges={badgePage.badgeShelf.hasMoreLockedBadges}
        remainingLockedBadges={badgePage.badgeShelf.remainingLockedBadges}
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
              Math.min(
                badgePage.badgeShelf.lockedBadgesSorted.length,
                current + badgePage.pageSizes.lockedBadgePageSize,
              ),
            );
          });
        }}
      />
    </div>
  );
}
