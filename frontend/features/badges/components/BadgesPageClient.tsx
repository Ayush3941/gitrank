"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Crown,
  Gem,
  Lock,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Unlock,
} from "lucide-react";
import { startTransition, type ReactNode, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
import { StaleState } from "@/components/shared/StaleState";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { selectLatestActionableSyncRunOutcome } from "@/lib/presentation/sync-run-diagnostics";
import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
import type { BadgeRarity } from "@/types/gitrank";
const LOCKED_BADGE_PAGE_SIZE_DEFAULT = 8;
const LOCKED_BADGE_PAGE_SIZE_CONSTRAINED = 4;
const BADGE_SHELF_PAGE_SIZE_DEFAULT = 10;
const BADGE_SHELF_PAGE_SIZE_CONSTRAINED = 6;
const BADGE_RARITY_FILTERS: Array<BadgeRarity | "All"> = [
  "All",
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythic",
];
const BADGE_VISIBILITY_FILTERS: Array<"All" | "Unlocked" | "Locked"> = [
  "All",
  "Unlocked",
  "Locked",
];

const BadgeGrid = dynamic(
  () =>
    import("@/features/badges/components/BadgeGrid").then(
      (mod) => mod.BadgeGrid,
    ),
  {
    loading: () => <BadgeShelfPlaceholder label="Loading badge shelf" />,
  },
);

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
  const [rarity, setRarity] = useState<BadgeRarity | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Unlocked" | "Locked">("All");
  const deferredRarity = useDeferredValue(rarity);
  const deferredVisibility = useDeferredValue(visibility);
  const [unlockNotice, setUnlockNotice] = useState("");
  const [visibleLockedCount, setVisibleLockedCount] = useState(lockedBadgePageSize);
  const [visibleBadgeCount, setVisibleBadgeCount] = useState(badgeShelfPageSize);
  const [showLockedBadges, setShowLockedBadges] = useState(false);
  const badgesEarnedRegionId = useId();
  const badgesLockedRegionId = useId();
  const badgesLockedToggleId = useId();
  const badgesFilterStatusId = useId();
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
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const staleNotice = useMemo(
    () =>
      buildStaleSyncNotice({
        syncState: syncStateForDisplay === "partially_synced" ? "partially_synced" : "stale",
        refreshedAt: profile?.refreshedAt ?? new Date().toISOString(),
        latestSyncOutcome,
        snapshotLabel: "Badge snapshot",
        partialFallback:
          "Badge snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
        staleFallback:
          "New unlocks can appear after the next completed sync.",
      }),
    [latestSyncOutcome, profile?.refreshedAt, syncStateForDisplay],
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
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
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

  function handleRarityChange(value: BadgeRarity | "All") {
    startTransition(() => {
      setRarity(value);
      setVisibleLockedCount(lockedBadgePageSize);
      setVisibleBadgeCount(badgeShelfPageSize);
    });
  }

  function handleVisibilityChange(value: "All" | "Unlocked" | "Locked") {
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
              { label: `Total ${totalCount}` },
              {
                label: `Completion ${completionPercent}%`,
                tone: completionPercent >= 100 ? "success" : completionPercent >= 50 ? "info" : "warning",
              },
              {
                label: `Locked ${lockedBadges.length}`,
                tone: lockedBadges.length > 0 ? "warning" : "success",
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ProfileEvidenceStateChip
              showFreshness={showRefreshPill}
              refreshedAt={profile?.refreshedAt}
              syncState={syncStateForDisplay}
            />
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/contributions" prefetch={false}>
                Contributions
              </Link>
            </Button>
          </div>
        )}
      />
      <section className="render-opt-section space-y-4">
        {syncStateForDisplay === "stale" || syncStateForDisplay === "partially_synced" ? (
          <StaleState
            message={staleNotice.message}
            reasonMessage={staleNotice.reasonMessage}
            updatedAt={profile.refreshedAt}
            onRefresh={staleSyncRefresh.onRefresh}
            isRefreshing={staleSyncRefresh.isRefreshing}
            refreshLabel={staleSyncRefresh.refreshLabel}
            actionLabel="Open sync settings"
            actionHref="/dashboard/settings"
            analyticsTarget="badges:stale"
          />
        ) : null}
        {!isLoading && !isError && profile ? (
          <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Progress overview</h2>
                  <p className="mt-1 text-sm text-muted">
                    {(abraInsights.data?.archetype ?? fallbackArchetype)} track
                  </p>
                  <ExpandableText
                    text={
                      abraInsights.data?.identitySummary ||
                      "Using deterministic badge guidance right now."
                    }
                    lines={2}
                    minLengthForToggle={170}
                    className="mt-2 max-w-3xl"
                    textClassName="text-sm text-muted"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <BadgeMetric label="Unlocked" value={unlockedCount} icon={<ShieldCheck className="h-4 w-4 text-cyan-200" />} />
                <BadgeMetric label="Completion" value={`${completionPercent}%`} icon={<Crown className="h-4 w-4 text-fuchsia-200" />} />
                <BadgeMetric label="Level" value={profile.user.level.currentLevel} icon={<Trophy className="h-4 w-4 text-violet-200" />} />
                <BadgeMetric label="Current streak" value={`${streak.currentStreakDays}d`} icon={<Sparkles className="h-4 w-4 text-emerald-200" />} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-cyan-200">Badge progress</p>
                <Progress value={completionPercent} />
              </div>
              <InlineNotice
                message={unlockNotice}
                placeholder="Badge update"
                variant="success"
                minHeightClassName="min-h-7"
                onDismiss={() => {
                  setUnlockNotice("");
                }}
                dismissLabel="Dismiss badge update"
              />
              {nextUnlockTarget ? (
                <div className="neon-surface space-y-3 border border-primary/22 px-4 py-4">
                  <p className="text-xs font-medium text-primary">Closest next unlock</p>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{nextUnlockTarget.name}</p>
                      <p className="mt-1 text-sm text-muted">
                        {nextUnlockTarget.progress ?? 0}% complete • {nextUnlockTarget.rarity}
                      </p>
                    </div>
                    <Button asChild variant="secondary" size="sm">
                      <Link href={unlockRecoveryHref(nextUnlockTarget.unlockCondition)} prefetch={false}>
                        {unlockRecoveryLabel(nextUnlockTarget.unlockCondition)}
                      </Link>
                    </Button>
                  </div>
                  <ExpandableText
                    text={nextUnlockTarget.unlockCondition}
                    lines={3}
                    minLengthForToggle={140}
                    textClassName="text-sm text-muted"
                    showMoreLabel="Read unlock path"
                    showLessLabel="Hide unlock path"
                  />
                </div>
              ) : null}
            </div>
          </GlowCard>
        ) : null}
      </section>
      <section className="render-opt-section space-y-4">
        <div className="space-y-3">
          <p id={badgesFilterStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            Showing {filtered.length} of {totalCount} badges
          </p>
          <ControlSurface>
            <FilterControlsHeader
              label="Badge controls"
              summary={isFiltering ? "Updating shelf..." : `${filtered.length} of ${totalCount} badges`}
              activeFilterCount={activeFilterCount}
              resetAction={{
                onReset: handleResetFilters,
                enabled: canResetFilters,
                ariaControls: badgesEarnedRegionId,
              }}
            />
            <div className="grid gap-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary">Rarity</p>
                <SegmentedTablist
                  options={BADGE_RARITY_FILTERS.map((item) => ({
                    value: item,
                    label: item,
                    compactLabel:
                      item === "Legendary"
                        ? "Legend"
                        : item === "Uncommon"
                          ? "Uncommon"
                          : item === "Common"
                            ? "Common"
                            : item === "Mythic"
                              ? "Mythic"
                              : item,
                    icon: <Gem className="h-4 w-4" />,
                    minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
                  }))}
                  value={rarity}
                  onValueChange={handleRarityChange}
                  ariaLabel="Badge rarity filters"
                  ariaDescribedBy={badgesFilterStatusId}
                  ariaControls={badgesEarnedRegionId}
                  tabIdPrefix="badge-rarity-tab"
                  wrap
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-primary">State</p>
                <SegmentedTablist
                  options={BADGE_VISIBILITY_FILTERS.map((item) => {
                    const Icon = item === "Unlocked" ? Unlock : item === "Locked" ? Lock : Medal;
                    const count =
                      item === "All"
                        ? totalCount
                        : item === "Unlocked"
                          ? unlockedCount
                          : totalCount - unlockedCount;
                    return {
                      value: item,
                      label: item,
                      icon: <Icon className="h-4 w-4" />,
                      count,
                      minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
                    };
                  })}
                  value={visibility}
                  onValueChange={handleVisibilityChange}
                  ariaLabel="Badge visibility filters"
                  ariaDescribedBy={badgesFilterStatusId}
                  ariaControls={badgesEarnedRegionId}
                  tabIdPrefix="badge-visibility-tab"
                  wrap
                />
              </div>
            </div>
          </ControlSurface>
        </div>
        <div id={badgesEarnedRegionId}>
          {isLoading ? <LoadingState message="Loading badge shelf..." /> : null}
          {isError ? (
            <ErrorState
              title="Badge sync failed"
              description="Badge refresh failed. Retry or use your latest snapshot."
              onRetry={() => {
                void refetch();
              }}
              fallbackLabel="Open sync settings"
              fallbackHref="/dashboard/settings"
              analyticsTarget="badges:error"
            />
          ) : null}
          {!isLoading && !isError && filtered.length === 0 ? (
            <EmptyState
              eyebrow={canResetFilters && totalCount > 0 ? "Filter results" : "Badge progression"}
              title={
                canResetFilters && totalCount > 0
                  ? "No badges match current filters."
                  : "Your badge shelf is waiting."
              }
              description={
                canResetFilters && totalCount > 0
                  ? "Reset filters to view earned and locked badges."
                  : "Complete a meaningful merged PR to unlock badges."
              }
              actionLabel={canResetFilters && totalCount > 0 ? "Reset filters" : "Open quests"}
              actionHref={canResetFilters && totalCount > 0 ? undefined : "/dashboard/quests"}
              onAction={canResetFilters && totalCount > 0 ? handleResetFilters : undefined}
              analyticsTarget={
                canResetFilters && totalCount > 0 ? "badges:empty-filtered" : "badges:empty"
              }
            />
          ) : null}
          {!isLoading && !isError && filtered.length ? (
            <div className="space-y-3">
              <BadgeGrid
                badges={visibleBadges}
                stories={abraInsights.data?.badgeStories}
              />
              {hasMoreBadges ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">{remainingBadges} badges remaining</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-controls={badgesEarnedRegionId}
                    onClick={() => {
                      startTransition(() => {
                        setVisibleBadgeCount((current) =>
                          Math.min(filtered.length, current + badgeShelfPageSize),
                        );
                      });
                    }}
                  >
                    Show more badges
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
      {!isLoading && !isError ? (
        <section className="render-opt-section space-y-3">
          <div className="neon-surface flex flex-wrap items-center justify-between gap-3 rounded-[1rem] px-4 py-3">
            <h2 className="text-sm font-semibold text-white">
              Locked paths ({lockedBadges.length})
            </h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              id={badgesLockedToggleId}
              aria-controls={badgesLockedRegionId}
              aria-expanded={showLockedBadges}
              onClick={() => {
                setShowLockedBadges((current) => !current);
              }}
            >
              {showLockedBadges ? "Hide details" : "Show details"}
            </Button>
          </div>
          {!showLockedBadges ? (
            lockedBadgePreview.length > 0 ? (
              <div className="neon-surface rounded-[1.4rem] border border-fuchsia-300/18 px-4 py-4">
                <p className="text-xs font-medium text-fuchsia-200">Upcoming unlock queue</p>
                <ul role="list" className="mt-3 grid gap-2 md:grid-cols-3">
                  {lockedBadgePreview.map((badge) => (
                    <li key={`${badge.id}-preview`} className="list-none rounded-[0.8rem] border border-fuchsia-300/20 bg-fuchsia-400/6 px-3 py-2">
                      <p className="text-sm font-semibold text-white">{badge.name}</p>
                      <p className="mt-1 text-xs text-muted">{badge.rarity}</p>
                      <p className="mt-1 text-xs text-cyan-100">{badge.progress ?? 0}% complete</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">
                  Expand to view full unlock conditions and path links.
                </p>
              </div>
            ) : (
              <div className="neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4 text-sm text-muted">
                No locked badge definitions are returned by this snapshot.
              </div>
            )
          ) : null}
          <div
            id={badgesLockedRegionId}
            role="region"
            aria-labelledby={badgesLockedToggleId}
            hidden={!showLockedBadges}
            className="neon-surface rounded-[1.4rem] border border-fuchsia-300/24 p-3"
          >
            {lockedBadges.length > 0 ? (
              <>
                <ul role="list" className="grid gap-3 md:grid-cols-3">
                  {visibleLockedBadges.map((badge) => (
                    <li key={badge.id} className="render-opt-card neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-medium text-fuchsia-200">{badge.rarity}</p>
                        <span className="neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold">
                          {badge.progress ?? 0}% complete
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">{badge.name}</h3>
                      <ExpandableText
                        text={badge.unlockCondition}
                        lines={3}
                        minLengthForToggle={120}
                        className="mt-2"
                        textClassName="text-sm text-muted"
                        showMoreLabel="Expand condition"
                        showLessLabel="Collapse condition"
                      />
                      <div className="mt-3 space-y-1">
                        <Progress value={badge.progress ?? 0} />
                        <p className="text-xs text-muted">
                          {badge.progress ?? 0}% verified progress • {Math.max(0, 100 - (badge.progress ?? 0))}% remaining
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-cyan-100">
                          Next move: {unlockRecoveryLabel(badge.unlockCondition)}
                        </p>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={unlockRecoveryHref(badge.unlockCondition)} prefetch={false}>Open path</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                {hasMoreLockedBadges ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">{remainingLockedBadges} locked paths remaining</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        startTransition(() => {
                          setVisibleLockedCount((current) =>
                            Math.min(lockedBadgesSorted.length, current + lockedBadgePageSize),
                          );
                        });
                      }}
                    >
                      Show more locked paths
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4 text-sm text-muted">
                No locked badge definitions are returned by this snapshot.
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function unlockRecoveryHref(condition: string): string {
  const text = condition.toLowerCase();
  if (
    text.includes("streak")
    || text.includes("weekly")
    || text.includes("daily")
    || text.includes("quest")
  ) {
    return "/dashboard/quests";
  }
  return "/dashboard/contributions";
}

function unlockRecoveryLabel(condition: string): string {
  const text = condition.toLowerCase();
  if (
    text.includes("streak")
    || text.includes("weekly")
    || text.includes("daily")
    || text.includes("quest")
  ) {
    return "Open quests";
  }
  return "Open contributions";
}

function BadgeMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="neon-metric rounded-[1.4rem] px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        {value}
        {icon}
      </p>
    </div>
  );
}

function BadgeShelfPlaceholder({ label }: { label: string }) {
  return (
    <GlowCard className="min-h-[18rem] space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-9 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
