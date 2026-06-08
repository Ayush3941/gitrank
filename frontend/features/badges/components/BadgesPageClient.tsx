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
import {
  BadgesShelfControls,
  type BadgeRarityFilter,
  type BadgeVisibilityFilter,
} from "@/features/badges/components/BadgesShelfControls";
import { BadgesShelfResults } from "@/features/badges/components/BadgesShelfResults";
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
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import { toRatioPercent } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
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
  const canResetFilters = rarity !== "All" || visibility !== "All";
  const isFiltering = deferredRarity !== rarity || deferredVisibility !== visibility;
  const activeFilterCount =
    (rarity !== "All" ? 1 : 0) + (visibility !== "All" ? 1 : 0);

  const allBadges = useMemo(() => deduplicateBadgesByName(data?.badges ?? []), [data?.badges]);
  const filtered =
    allBadges.filter((badge) => {
      const rarityMatch = deferredRarity === "All" || badge.rarity === deferredRarity;
      const visibilityMatch =
        deferredVisibility === "All" ||
        (deferredVisibility === "Unlocked" && badge.unlocked) ||
        (deferredVisibility === "Locked" && !badge.unlocked);
      return rarityMatch && visibilityMatch;
    });
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
  const lockedBadges = allBadges.filter((badge) => !badge.unlocked);
  const lockedBadgesSorted = [...lockedBadges].sort((left, right) => {
    const progressDelta = (right.progress ?? 0) - (left.progress ?? 0);
    if (progressDelta !== 0) {
      return progressDelta;
    }
    return left.name.localeCompare(right.name);
  });
  const unlockedCount = allBadges.filter((badge) => badge.unlocked).length;
  const totalCount = allBadges.length;
  const visibleLockedBadges = lockedBadgesSorted.slice(0, visibleLockedCount);
  const lockedBadgePreview = lockedBadgesSorted.slice(0, 3);
  const hasMoreLockedBadges = lockedBadgesSorted.length > visibleLockedBadges.length;
  const remainingLockedBadges = Math.max(0, lockedBadgesSorted.length - visibleLockedBadges.length);
  const visibleBadges = filtered.slice(0, visibleBadgeCount);
  const hasMoreBadges = filtered.length > visibleBadges.length;
  const remainingBadges = Math.max(0, filtered.length - visibleBadges.length);
  const completionPercent = toRatioPercent(unlockedCount / totalCount);
  const streak = summarizeContributionStreak(profile?.user.contributions ?? []);
  const nextUnlockTarget = lockedBadgesSorted[0] ?? null;

  const abraInsights = useAbraInsights(
    profile &&
      !constrainedNetwork &&
      shouldRequestAbraInsights({
        showAiSummaries: profile.user.privacy.showAiSummaries !== false,
        mergedPrCount: profile.user.mergedPrCount,
        contributionCount: profile.user.contributions.length,
      })
      ? {
          profile: {
            username: profile.user.username,
            displayName: profile.user.displayName,
            currentTitle: profile.user.title,
            rankTier: profile.user.level.rankTier,
            level: profile.user.level.currentLevel,
            totalXp: profile.user.level.currentXp,
            mergedPrCount: profile.user.mergedPrCount,
            strongestSignals: profile.user.strongestSignals,
            repositoriesTouched: profile.topRepositories.length,
            badgeCount: unlockedCount,
            streakDays: streak.currentStreakDays,
          },
          contributions: profile.user.contributions.slice(0, 8).map((row) => ({
            id: row.id,
            title: row.title,
            owner: row.owner,
            repo: row.repo,
            number: row.number,
            category: row.category,
            status: row.status,
            xpEarned: row.xpEarned,
            mergedAt: row.mergedAt,
            summary: row.aiSummary,
            evidenceSignals: row.evidenceSignals,
          })),
          badges: filtered.slice(0, 10).map((badge) => ({
            id: badge.id,
            name: badge.name,
            rarity: badge.rarity,
            unlocked: badge.unlocked,
            earnedAt: badge.earnedAt,
            description: badge.description,
            unlockCondition: badge.unlockCondition,
            progress: badge.progress ?? (badge.unlocked ? 100 : 0),
            evidencePrIds: badge.evidencePrIds,
          })),
        }
      : null,
  );
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
    previousUnlockedCountRef.current = unlockedCount;
    if (previous === null || unlockedCount <= previous) {
      return;
    }
    const delta = unlockedCount - previous;
    setUnlockNotice(
      delta === 1
        ? "Badge unlocked. Your shelf gained 1 new achievement."
        : `Badges unlocked. Your shelf gained ${delta} new achievements.`,
    );
  }, [data, isError, isLoading, unlockedCount]);

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
              { label: `Earned ${unlockedCount}` },
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
            unlockedCount={unlockedCount}
            completionPercent={completionPercent}
            level={profile.user.level.currentLevel}
            streakDays={streak.currentStreakDays}
            unlockNotice={unlockNotice}
            nextUnlockTarget={nextUnlockTarget}
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
          filteredCount={filtered.length}
          totalCount={totalCount}
          unlockedCount={unlockedCount}
          isFiltering={isFiltering}
          activeFilterCount={activeFilterCount}
          canResetFilters={canResetFilters}
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
            visibleBadges={visibleBadges}
            stories={abraInsights.data?.badgeStories}
            isLoading={isLoading}
            isError={isError}
            filteredCount={filtered.length}
            totalCount={totalCount}
            canResetFilters={canResetFilters}
            hasMoreBadges={hasMoreBadges}
            remainingBadges={remainingBadges}
            regionId={badgesEarnedRegionId}
            onRetry={() => {
              void refetch();
            }}
            onResetFilters={handleResetFilters}
            onShowMoreBadges={() => {
              startTransition(() => {
                setVisibleBadgeCount((current) =>
                  Math.min(filtered.length, current + badgeShelfPageSize),
                );
              });
            }}
          />
        </div>
      </section>
      <BadgesLockedPathsSection
        lockedBadges={lockedBadges}
        lockedBadgePreview={lockedBadgePreview}
        visibleLockedBadges={visibleLockedBadges}
        hasMoreLockedBadges={hasMoreLockedBadges}
        remainingLockedBadges={remainingLockedBadges}
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
              Math.min(lockedBadgesSorted.length, current + lockedBadgePageSize),
            );
          });
        }}
      />
    </div>
  );
}
