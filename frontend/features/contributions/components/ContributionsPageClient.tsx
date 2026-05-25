"use client";

import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download, LayoutList, Rows3 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ContributionPulseStrip } from "@/components/shared/ContributionPulseStrip";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { StaleState } from "@/components/shared/StaleState";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { useContributions } from "@/hooks/use-contributions";
import { useAbraInsights } from "@/hooks/use-abra-insights";
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
import { formatRelativeDays } from "@/lib/formatters";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
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

const filterMap: Record<string, string> = {
  All: "All",
  Merged: "merged",
  Open: "open",
  Docs: "Documentation",
  Tests: "Testing",
  "Bug Fixes": "Bug Fix",
  Infra: "Infrastructure",
  Security: "Security",
  Performance: "Performance",
  "High XP": "High XP",
};

const CONTRIBUTION_CARD_PAGE_SIZE_DEFAULT = 12;
const CONTRIBUTION_CARD_PAGE_SIZE_CONSTRAINED = 6;
const ABRA_CONTRIBUTION_SAMPLE_LIMIT = 24;
const CONTRIBUTION_CARDS_REGION_ID = "contributions-cards-region";
const CONTRIBUTION_SEARCH_DEBOUNCE_MS = 220;
const CONTRIBUTION_RENDER_HARD_CAP = 100;
const HIGH_XP_COUNT_THRESHOLD = 200;

export function ContributionsPageClient() {
  const constrainedNetwork = useNetworkConstraintPreference();
  const reducedGamification = useReducedGamification();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact">("Newest");
  const [exportNotice, setExportNotice] = useState("");
  const [showCardDetails, setShowCardDetails] = useState(false);
  const debouncedSearch = useDebouncedValue(search, CONTRIBUTION_SEARCH_DEBOUNCE_MS);
  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const deferredSort = useDeferredValue(sort);
  const useLiteCards = constrainedNetwork || reducedGamification;
  const effectiveShowCardDetails = showCardDetails && !useLiteCards;
  const cardPageSize = useLiteCards
    ? CONTRIBUTION_CARD_PAGE_SIZE_CONSTRAINED
    : CONTRIBUTION_CARD_PAGE_SIZE_DEFAULT;
  const [visibleCardCount, setVisibleCardCount] = useState(cardPageSize);
  const { data, isLoading, isError, refetch } = useContributions({
    filter: filterMap[deferredFilter],
    search: deferredSearch,
    sort: deferredSort,
  });
  const profile = data?.profile;
  const contributionUniverse = useMemo(
    () => deduplicateContributionsByPR(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const statusCounts = useMemo(
    () => ({
      All: contributionUniverse.length,
      Merged: contributionUniverse.filter((row) => row.status === "merged").length,
      Open: contributionUniverse.filter((row) => row.status === "open").length,
    }),
    [contributionUniverse],
  );
  const focusCounts = useMemo(
    () => ({
      Any: contributionUniverse.length,
      Docs: contributionUniverse.filter((row) => row.category === "Documentation").length,
      Tests: contributionUniverse.filter((row) => row.category === "Testing").length,
      "Bug Fixes": contributionUniverse.filter((row) => row.category === "Bug Fix").length,
      Infra: contributionUniverse.filter((row) => row.category === "Infrastructure").length,
      Security: contributionUniverse.filter((row) => row.category === "Security").length,
      Performance: contributionUniverse.filter((row) => row.category === "Performance").length,
      "High XP": contributionUniverse.filter((row) => row.xpEarned >= HIGH_XP_COUNT_THRESHOLD).length,
    }),
    [contributionUniverse],
  );
  const filteredRows = useMemo(
    () =>
      deduplicateContributionsByPR(data?.rows ?? []).slice(
        0,
        CONTRIBUTION_RENDER_HARD_CAP,
      ),
    [data?.rows],
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
  const canReset = filter !== "All" || search.trim().length > 0 || sort !== "Newest";
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
  const abraContributionSample = useMemo(
    () => filteredRows.slice(0, ABRA_CONTRIBUTION_SAMPLE_LIMIT),
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

  function handleFilterChange(next: string) {
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

  function handleSortChange(next: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact") {
    startTransition(() => {
      setSort(next);
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleResetFilters() {
    startTransition(() => {
      setFilter("All");
      setSearch("");
      setSort("Newest");
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
              { label: `Repos ${repositories.length}` },
              { label: `Streak ${streak.currentStreakDays}d` },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            <SnapshotFreshnessPill refreshedAt={profile?.refreshedAt} label="Refreshed" />
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
                aria-controls={CONTRIBUTION_CARDS_REGION_ID}
              >
                {showCardDetails ? (
                  <>
                    <Rows3 className="h-4 w-4" />
                    Hide details
                  </>
                ) : (
                  <>
                    <LayoutList className="h-4 w-4" />
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
              <Download className="h-4 w-4" />
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
      {profile?.user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Contribution evidence refreshed ${formatRelativeDays(
            profile.refreshedAt,
          )}. New PR rows can appear after the next sync.`}
          updatedAt={profile.refreshedAt}
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="contributions:stale"
        />
      ) : null}
      {profile ? (
        <section className="render-opt-section">
          <GlowCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-primary">Contribution momentum</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Recent activity signal</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
                  Current streak {streak.currentStreakDays}d
                </span>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
                  Best streak {streak.bestStreakDays}d
                </span>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
                  Active days {streak.activeDaysThisYear}
                </span>
              </div>
            </div>
            <ContributionPulseStrip
              contributions={profile.user.contributions}
              days={21}
              label="21-day contribution pulse"
            />
          </GlowCard>
        </section>
      ) : null}
      <section>
        <ContributionFilters
          value={filter}
          onValueChange={handleFilterChange}
          search={search}
          onSearchChange={handleSearchChange}
          sort={sort}
          onSortChange={handleSortChange}
          resultsRegionId={CONTRIBUTION_CARDS_REGION_ID}
          resultCount={filteredRows.length}
          isFiltering={isFiltering}
          canReset={canReset}
          onReset={handleResetFilters}
          compact
          onClearSearch={handleClearSearchFilter}
          statusCounts={statusCounts}
          focusCounts={focusCounts}
        />
        <p className="mt-2 text-xs text-muted">
          Categories are a readable summary of recent PR themes, not fixed labels about your overall expertise.
        </p>
      </section>
      {isLoading ? <LoadingState message="Loading contributions..." /> : null}
      {isError ? (
        <ErrorState
          title="Contribution sync failed"
          description="Sync refresh failed. Retry or open sync settings."
          onRetry={() => {
            void refetch();
          }}
          fallbackLabel="Open sync settings"
          fallbackHref="/dashboard/settings"
          analyticsTarget="contributions:error"
        />
      ) : null}
      {!isLoading && !isError && filteredRows.length === 0 ? (
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
              : "Open sync settings to refresh GitHub evidence for scored PR cards."
          }
          actionLabel={isFilteredNoResults ? "Reset filters" : "Open sync settings"}
          actionHref={isFilteredNoResults ? undefined : "/dashboard/settings"}
          onAction={isFilteredNoResults ? handleResetFilters : undefined}
          analyticsTarget={isFilteredNoResults ? "contributions:empty-filtered" : "contributions:empty"}
        />
      ) : null}
      {!isLoading && !isError && filteredRows.length ? (
        <section className="render-opt-section space-y-4">
          <div className="space-y-4">
            <div id={CONTRIBUTION_CARDS_REGION_ID}>
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
                  aria-controls={CONTRIBUTION_CARDS_REGION_ID}
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
        </section>
      ) : null}
    </div>
  );
}

function deduplicateContributionsByPR(rows: Contribution[]): Contribution[] {
  const byPR = new Map<string, Contribution>();
  for (const row of rows) {
    const key = `${row.owner.toLowerCase()}/${row.repo.toLowerCase()}#${row.number}`;
    const existing = byPR.get(key);
    if (!existing) {
      byPR.set(key, row);
      continue;
    }
    const existingMergedAt = Date.parse(existing.mergedAt);
    const nextMergedAt = Date.parse(row.mergedAt);
    const preferRow =
      row.xpEarned > existing.xpEarned ||
      (row.xpEarned === existing.xpEarned && nextMergedAt > existingMergedAt);
    if (preferRow) {
      byPR.set(key, row);
    }
  }
  return Array.from(byPR.values());
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
