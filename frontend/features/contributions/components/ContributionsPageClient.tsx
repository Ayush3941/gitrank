"use client";

import dynamic from "next/dynamic";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
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

const CONTRIBUTION_CARD_PAGE_SIZE_DEFAULT = 24;
const CONTRIBUTION_CARD_PAGE_SIZE_CONSTRAINED = 12;
const ABRA_CONTRIBUTION_SAMPLE_LIMIT = 24;
const CONTRIBUTION_CARDS_REGION_ID = "contributions-cards-region";
const CONTRIBUTION_SEARCH_DEBOUNCE_MS = 220;
const CONTRIBUTION_RENDER_HARD_CAP = 100;

export function ContributionsPageClient() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact">("Newest");
  const [exportNotice, setExportNotice] = useState("");
  const debouncedSearch = useDebouncedValue(search, CONTRIBUTION_SEARCH_DEBOUNCE_MS);
  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(debouncedSearch);
  const deferredSort = useDeferredValue(sort);
  const constrainedNetwork = useNetworkConstraintPreference();
  const reducedGamification = useReducedGamification();
  const useLiteCards = constrainedNetwork || reducedGamification;
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
    if (useLiteCards) {
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
        badgeCount: profile.user.badges.filter((badge) => badge.unlocked).length,
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
      badges: profile.user.badges.slice(0, 8).map((badge) => ({
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
    streak.currentStreakDays,
    useLiteCards,
  ]);

  const abraInsights = useAbraInsights(abraPayload);
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

  function handleClearCategoryFilter() {
    startTransition(() => {
      setFilter("All");
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleClearSortFilter() {
    startTransition(() => {
      setSort("Newest");
      setVisibleCardCount(cardPageSize);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contributions"
        title="Contributions"
        description="PR cards and battle reports."
        actions={(
          <div className="flex flex-wrap gap-2">
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
      {exportNotice ? (
        <p role="status" aria-live="polite" className="text-xs text-cyan-100">
          {exportNotice}
        </p>
      ) : null}
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
          onClearCategory={handleClearCategoryFilter}
          onClearSort={handleClearSortFilter}
        />
      </section>
      {isLoading ? <LoadingState message="Loading contributions..." /> : null}
      {isError ? (
        <ErrorState
          title="Contribution sync failed"
          description="GitHub data could not be refreshed. Retry or open sync settings."
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
              : "Run sync and merge PRs to populate reports."
          }
          actionLabel={isFilteredNoResults ? "Reset filters" : "Open quests"}
          actionHref={isFilteredNoResults ? undefined : "/dashboard/quests"}
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
    <GlowCard className="space-y-3">
      <p className="text-xs font-medium text-primary">Loading contribution cards</p>
      <div className="neon-skeleton h-9 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
