"use client";

import { startTransition, useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { PageHeader } from "@/components/shared/PageHeader";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { StaleState } from "@/components/shared/StaleState";
import { ContributionsCardsSection } from "@/features/contributions/components/ContributionsCardsSection";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { ContributionsHeaderActions } from "@/features/contributions/components/ContributionsHeaderActions";
import {
  buildContributionShelfModel,
  resolveContributionCardPageSize,
} from "@/features/contributions/lib/contribution-shelf-model";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useContributions } from "@/hooks/use-contributions";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import {
  useNetworkConstraintPreference,
  useReducedGamification,
} from "@/hooks/use-gamification-preference";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import {
  summarizeContributionStreak,
  summarizeRepositories,
} from "@/lib/metrics/contribution-metrics";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
import {
  CONTRIBUTION_DEFAULT_FILTER,
  CONTRIBUTION_DEFAULT_SORT,
  type ContributionFilterValue,
  type ContributionSortOption,
  toContributionQueryFilter,
} from "@/lib/runtime/contribution-filter-policy";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

const CONTRIBUTION_SEARCH_DEBOUNCE_MS = 220;
const CONTRIBUTIONS_SECTION_LINKS = [
  { id: "contributions-filters", label: "Filters" },
  { id: "contributions-cards", label: "Cards" },
];

export function ContributionsPageClient() {
  const contributionCardsRegionId = useId();
  const constrainedNetwork = useNetworkConstraintPreference();
  const reducedGamification = useReducedGamification();
  const [filter, setFilter] = useState<ContributionFilterValue>(CONTRIBUTION_DEFAULT_FILTER);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ContributionSortOption>(CONTRIBUTION_DEFAULT_SORT);
  const [exportNotice, setExportNotice] = useState("");
  const [showCardDetails, setShowCardDetails] = useState(false);
  const debouncedSearch = useDebouncedValue(search, CONTRIBUTION_SEARCH_DEBOUNCE_MS);
  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const deferredSort = useDeferredValue(sort);
  const useLiteCards = constrainedNetwork || reducedGamification;
  const cardPageSize = resolveContributionCardPageSize(useLiteCards);
  const [visibleCardCount, setVisibleCardCount] = useState(cardPageSize);
  const { data, isLoading, isError, error, refetch } = useContributions({
    filter: toContributionQueryFilter(deferredFilter),
    search: deferredSearch,
    sort: deferredSort,
  });
  const syncRunsQuery = useProfileSyncRuns();
  const runUserSync = useRunUserSync();
  const profile = data?.profile;
  const contributionShelf = useMemo(
    () =>
      buildContributionShelfModel({
        rows: data?.rows,
        contributions: profile?.user.contributions,
        highXPThreshold: profile?.highXPThreshold,
        scoreHistoryCap: profile?.scoreHistoryCap,
        filter,
        search,
        sort,
        debouncedSearch,
        deferredFilter,
        deferredSearch,
        deferredSort,
        visibleCardCount,
        useLiteCards,
        showCardDetails,
      }),
    [
      data?.rows,
      debouncedSearch,
      deferredFilter,
      deferredSearch,
      deferredSort,
      filter,
      profile?.highXPThreshold,
      profile?.scoreHistoryCap,
      profile?.user.contributions,
      search,
      showCardDetails,
      sort,
      useLiteCards,
      visibleCardCount,
    ],
  );

  const repositories = useMemo(
    () => summarizeRepositories(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const streak = useMemo(
    () => summarizeContributionStreak(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
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
  const staleNotice = useMemo(
    () =>
      buildStaleSyncNotice({
        syncState: displaySyncState === "partially_synced" ? "partially_synced" : "stale",
        refreshedAt: profile?.refreshedAt,
        latestSyncOutcome,
        snapshotLabel: "Contribution evidence",
        partialFallback:
          "Profile exists, but scored PR evidence is still empty. Keep auto-sync on and retry.",
        staleFallback:
          "New PR rows appear after sync completes.",
      }),
    [displaySyncState, latestSyncOutcome, profile?.refreshedAt],
  );
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(undefined),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const abraPayload = useMemo(() => {
    return buildAbraInsightsRequest({
      user: profile?.user,
      contributions: contributionShelf.abraContributionSample,
      badges: profile?.user.badges ?? [],
      repositoriesTouched: repositories.length,
      streakDays: streak.currentStreakDays,
      enabled: contributionShelf.effectiveShowCardDetails,
    });
  }, [
    contributionShelf.abraContributionSample,
    contributionShelf.effectiveShowCardDetails,
    profile?.user,
    repositories.length,
    streak.currentStreakDays,
  ]);

  const abraInsights = useAbraInsights(abraPayload);
  const hasCachedProfile = Boolean(data?.profile);
  const shouldBlockOnLoading = isLoading && !hasCachedProfile;
  const shouldBlockOnError = isError && !hasCachedProfile;
  const backgroundRefreshError = isError && hasCachedProfile
    ? `${sanitizeUserFacingError((error as Error | null)?.message || "", "stale-refresh")} Showing latest verified contribution data.`
    : "";

  useEffect(() => {
    if (!exportNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setExportNotice("");
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [exportNotice]);

  if (shouldBlockOnLoading) {
    return (
      <RouteLoadingState
        eyebrow="Contributions"
        title="Contributions"
        description="Scored PR cards with fast filters."
        variant="dashboard"
        cardCount={2}
      />
    );
  }

  if (shouldBlockOnError) {
    return (
      <ErrorState
        title="Contribution sync failed"
        description="Contribution data is unavailable right now. Retry or open sync settings."
        onRetry={() => {
          void refetch();
        }}
        fallbackLabel="Open sync settings"
        fallbackHref="/dashboard/settings"
        analyticsTarget="contributions:error"
      />
    );
  }

  function handleFilterChange(next: ContributionFilterValue) {
    startTransition(() => {
      setFilter(next);
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleSearchChange(next: string) {
    startTransition(() => {
      setSearch(next);
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleSortChange(next: ContributionSortOption) {
    startTransition(() => {
      setSort(next);
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleResetFilters() {
    startTransition(() => {
      setFilter(CONTRIBUTION_DEFAULT_FILTER);
      setSearch("");
      setSort(CONTRIBUTION_DEFAULT_SORT);
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleClearSearchFilter() {
    startTransition(() => {
      setSearch("");
      setVisibleCardCount(cardPageSize);
    });
  }

  return (
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Contributions"
        title="Contributions"
        description="Scored PR cards with fast filters."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Evidence rows ${contributionShelf.filteredRows.length}` },
              {
                label: `Sync ${formatSyncStateLabel(displaySyncState)}`,
                tone: toneForSyncState(displaySyncState),
              },
            ]}
          />
        )}
        actions={(
          <ContributionsHeaderActions
            cardsRegionId={contributionCardsRegionId}
            rows={contributionShelf.filteredRows}
            showFreshness={shouldShowProfileFreshnessPill(
              showRefreshPill,
              displaySyncState,
              appInstallationBlocked,
            )}
            refreshedAt={profile?.refreshedAt}
            syncState={displaySyncState}
            useLiteCards={useLiteCards}
            showCardDetails={showCardDetails}
            onToggleCardDetails={() => {
              startTransition(() => {
                setShowCardDetails((current) => !current);
              });
            }}
            onExportStatusChange={setExportNotice}
          />
        )}
      />
      <InlineNotice
        message={exportNotice}
        placeholder="Export status"
        variant="info"
        minHeightClassName="min-h-7"
        onDismiss={() => {
          setExportNotice("");
        }}
        dismissLabel="Dismiss export status"
      />
      {backgroundRefreshError ? (
        <InlineNotice
          message={backgroundRefreshError}
          placeholder="Background refresh status"
          variant="warning"
          minHeightClassName="min-h-0"
        />
      ) : null}
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
          analyticsTarget="contributions:stale"
        />
      ) : null}
      <InPageSectionNav sections={CONTRIBUTIONS_SECTION_LINKS} className="render-opt-section" />
      <section
        id="contributions-filters"
        data-scroll-target="true"
        className="render-opt-section"
      >
        <ContributionFilters
          value={filter}
          onValueChange={handleFilterChange}
          search={search}
          onSearchChange={handleSearchChange}
          sort={sort}
          onSortChange={handleSortChange}
          resultsRegionId={contributionCardsRegionId}
          resultCount={contributionShelf.filteredRows.length}
          isFiltering={contributionShelf.isFiltering}
          canReset={contributionShelf.canReset}
          onReset={handleResetFilters}
          compact
          onClearSearch={handleClearSearchFilter}
          statusCounts={contributionShelf.statusCounts}
          focusCounts={contributionShelf.focusCounts}
          contextNote="Categories reflect your recent PR work and help choose the next lane."
        />
      </section>
      <ContributionsCardsSection
        regionId={contributionCardsRegionId}
        filteredRows={contributionShelf.filteredRows}
        visibleRows={contributionShelf.visibleRows}
        narratives={abraInsights.data?.contributionNarratives}
        isFiltering={contributionShelf.isFiltering}
        isFilteredNoResults={contributionShelf.isFilteredNoResults}
        hasMoreRows={contributionShelf.hasMoreRows}
        remainingRows={contributionShelf.remainingRows}
        cardPageSize={contributionShelf.cardPageSize}
        useLiteCards={useLiteCards}
        showDetails={contributionShelf.effectiveShowCardDetails}
        onResetFilters={handleResetFilters}
        onShowMoreRows={() => {
          startTransition(() => {
            setVisibleCardCount((current) =>
              Math.min(
                contributionShelf.filteredRows.length,
                current + contributionShelf.cardPageSize,
              ),
            );
          });
        }}
      />
    </div>
  );
}
