"use client";

import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useEffect, useId, useMemo, useState } from "react";
import { Download, LayoutList, Rows3 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { StaleState } from "@/components/shared/StaleState";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
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
import { Button } from "@/components/ui/button";
import {
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import {
  summarizeContributionStreak,
  summarizeRepositories,
} from "@/lib/metrics/contribution-metrics";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { deduplicateContributionsByPullRequest } from "@/lib/presentation/contribution-dedup";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
import { contributionDisplayConfig } from "@/lib/runtime/contribution-display-config";
import {
  buildContributionFocusCounts,
  buildContributionStatusCounts,
  CONTRIBUTION_DEFAULT_FILTER,
  CONTRIBUTION_DEFAULT_SORT,
  type ContributionFilterValue,
  type ContributionSortOption,
  toContributionQueryFilter,
} from "@/lib/runtime/contribution-filter-policy";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import type { Contribution } from "@/types/gitrank";

const ContributionList = dynamic(
  () =>
    import("@/features/contributions/components/ContributionList").then(
      (mod) => mod.ContributionList,
    ),
  {
    loading: () => <ContributionListPlaceholder />,
  },
);

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
  const effectiveShowCardDetails = showCardDetails && !useLiteCards;
  const cardPageSize = useLiteCards
    ? contributionDisplayConfig.constrainedCardPageSize
    : contributionDisplayConfig.cardPageSize;
  const [visibleCardCount, setVisibleCardCount] = useState(cardPageSize);
  const { data, isLoading, isError, error, refetch } = useContributions({
    filter: toContributionQueryFilter(deferredFilter),
    search: deferredSearch,
    sort: deferredSort,
  });
  const syncRunsQuery = useProfileSyncRuns();
  const runUserSync = useRunUserSync();
  const profile = data?.profile;
  const contributionUniverse = useMemo(
    () => deduplicateContributionsByPullRequest(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const effectiveHighXPThreshold = Math.max(
    1,
    profile?.highXPThreshold ?? contributionDisplayConfig.highXPThreshold,
  );
  const statusCounts = useMemo(
    () => buildContributionStatusCounts(contributionUniverse),
    [contributionUniverse],
  );
  const focusCounts = useMemo(
    () => buildContributionFocusCounts(contributionUniverse, effectiveHighXPThreshold),
    [contributionUniverse, effectiveHighXPThreshold],
  );
  const effectiveHistoryCap = Math.max(
    1,
    Math.min(
      contributionDisplayConfig.renderHardCap,
      data?.profile.scoreHistoryCap ?? contributionDisplayConfig.renderHardCap,
    ),
  );
  const filteredRows = useMemo(
    () =>
      deduplicateContributionsByPullRequest(data?.rows ?? []).slice(
        0,
        effectiveHistoryCap,
      ),
    [data?.rows, effectiveHistoryCap],
  );
  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCardCount),
    [filteredRows, visibleCardCount],
  );
  const hasMoreRows = filteredRows.length > visibleRows.length;
  const remainingRows = Math.max(0, filteredRows.length - visibleRows.length);
  const isFiltering =
    deferredFilter !== filter ||
    deferredSearch !== debouncedSearch ||
    debouncedSearch !== search ||
    deferredSort !== sort;
  const canReset =
    filter !== CONTRIBUTION_DEFAULT_FILTER ||
    search.trim().length > 0 ||
    sort !== CONTRIBUTION_DEFAULT_SORT;
  const totalContributionEvidence = profile?.user.contributions.length ?? 0;
  const isFilteredNoResults =
    canReset && totalContributionEvidence > 0 && filteredRows.length === 0;

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
        refreshedAt: profile?.refreshedAt ?? new Date().toISOString(),
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
  const abraContributionSample = useMemo(
    () => filteredRows.slice(0, contributionDisplayConfig.abraSampleLimit),
    [filteredRows],
  );
  const abraPayload = useMemo(() => {
    if (!profile) {
      return null;
    }
    if (!effectiveShowCardDetails) {
      return null;
    }
    if (
      !shouldRequestAbraInsights({
        showAiSummaries: profile.user.privacy.showAiSummaries !== false,
        mergedPrCount: profile.user.mergedPrCount,
        contributionCount: abraContributionSample.length,
      })
    ) {
      return null;
    }
    const visibleBadges = deduplicateBadgesByName(profile.user.badges);
    return {
      profile: {
        username: profile.user.username,
        displayName: profile.user.displayName,
        currentTitle: profile.user.title,
        rankTier: profile.user.level.rankTier,
        level: profile.user.level.currentLevel,
        totalXp: profile.user.level.currentXp,
        mergedPrCount: profile.user.mergedPrCount,
        strongestSignals: profile.user.strongestSignals,
        repositoriesTouched: repositories.length,
        badgeCount: visibleBadges.filter((badge) => badge.unlocked).length,
        streakDays: streak.currentStreakDays,
      },
      contributions: abraContributionSample.map((row) => ({
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
      badges: visibleBadges.slice(0, 8).map((badge) => ({
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
    };
  }, [
    abraContributionSample,
    profile,
    repositories.length,
    effectiveShowCardDetails,
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
              { label: `Evidence rows ${filteredRows.length}` },
              {
                label: `Sync ${formatSyncStateLabel(displaySyncState)}`,
                tone: toneForSyncState(displaySyncState),
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            <ProfileEvidenceStateChip
              showFreshness={shouldShowProfileFreshnessPill(showRefreshPill, displaySyncState, appInstallationBlocked)}
              refreshedAt={profile?.refreshedAt}
              syncState={displaySyncState}
            />
            {!useLiteCards ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setShowCardDetails((current) => !current);
                  });
                }}
                aria-pressed={showCardDetails}
                aria-controls={contributionCardsRegionId}
              >
                {showCardDetails ? (
                  <>
                    <Rows3 className="h-4 w-4" aria-hidden="true" />
                    Hide details
                  </>
                ) : (
                  <>
                    <LayoutList className="h-4 w-4" aria-hidden="true" />
                    Show details
                  </>
                )}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!filteredRows.length) {
                  setExportNotice("No contribution rows are available to export.");
                  return;
                }
                downloadContributionsCSV(filteredRows);
                setExportNotice(`Exported ${filteredRows.length} contribution rows as CSV.`);
              }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
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
          resultCount={filteredRows.length}
          isFiltering={isFiltering}
          canReset={canReset}
          onReset={handleResetFilters}
          compact
          onClearSearch={handleClearSearchFilter}
          statusCounts={statusCounts}
          focusCounts={focusCounts}
          contextNote="Categories reflect your recent PR work and help choose the next lane."
        />
      </section>
      <section
        id="contributions-cards"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
      >
        {filteredRows.length === 0 ? (
          <EmptyState
            eyebrow={isFilteredNoResults ? "Filter results" : "Contribution evidence"}
            title={
              isFilteredNoResults
                ? "No contributions match current filters."
                : "No merged PRs found yet."
            }
            description={
              isFilteredNoResults
                ? "Reset filters or widen search."
                : "Keep this page open while auto-sync loads recent PR evidence."
            }
            actionLabel={isFilteredNoResults ? "Reset filters" : "Open sync settings"}
            actionHref={isFilteredNoResults ? undefined : "/dashboard/settings"}
            onAction={isFilteredNoResults ? handleResetFilters : undefined}
            analyticsTarget={isFilteredNoResults ? "contributions:empty-filtered" : "contributions:empty"}
          />
        ) : null}
        {filteredRows.length ? (
          <div className="space-y-4">
            <div id={contributionCardsRegionId}>
              <ContributionList
                items={visibleRows}
                narratives={abraInsights.data?.contributionNarratives}
                isBusy={isFiltering}
                totalCount={filteredRows.length}
                startPosition={1}
                useLiteCards={useLiteCards}
                showDetails={effectiveShowCardDetails}
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              {hasMoreRows ? (
                <Button
                  type="button"
                  variant="secondary"
                  aria-controls={contributionCardsRegionId}
                  aria-label={`Show ${Math.min(cardPageSize, remainingRows)} more contribution cards. ${remainingRows} remaining.`}
                  onClick={() => {
                    startTransition(() => {
                      setVisibleCardCount((current) =>
                        Math.min(filteredRows.length, current + cardPageSize),
                      );
                    });
                  }}
                >
                  Show more cards ({remainingRows} left)
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function downloadContributionsCSV(rows: Contribution[]) {
  const header = [
    "pr_url",
    "owner",
    "repo",
    "number",
    "title",
    "status",
    "category",
    "xp_earned",
    "difficulty_score",
    "impact_score",
    "review_depth_score",
    "test_signal_score",
    "changed_files",
    "merged_at",
    "merged_date_local",
    "maintainer_reviewed",
    "linked_issue",
    "ci_passed",
    "impact_summary",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        `https://github.com/${row.owner}/${row.repo}/pull/${row.number}`,
        row.owner,
        row.repo,
        row.number,
        row.title,
        row.status,
        row.category,
        row.xpEarned,
        row.difficultyScore,
        row.impactScore,
        row.reviewDepthScore,
        row.testSignalScore,
        row.changedFilesCount,
        row.mergedAt,
        formatCSVDate(row.mergedAt),
        row.maintainerReviewed,
        row.linkedIssue,
        row.ciPassed,
        sanitizeReportSummary(row.aiSummary),
      ]
        .map(toCSVCell)
        .join(","),
    ),
  ];

  const csv = `\uFEFF${lines.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `gitrank-contributions-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function toCSVCell(value: string | number | boolean): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function formatCSVDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleString();
}

function ContributionListPlaceholder() {
  return (
    <GlowCard className="min-h-[18rem] space-y-3">
      <p className="text-xs font-medium text-primary">Loading contribution cards</p>
      <div className="neon-skeleton h-9 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
