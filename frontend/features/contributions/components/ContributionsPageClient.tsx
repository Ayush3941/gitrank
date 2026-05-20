"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { ContributionList } from "@/features/contributions/components/ContributionList";
import { useContributions } from "@/hooks/use-contributions";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { Button } from "@/components/ui/button";
import {
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import {
  monthTimeline,
  summarizeContributionStreak,
  summarizeRepositories,
} from "@/lib/metrics/contribution-metrics";
import type { Contribution } from "@/types/gitrank";

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
const CONTRIBUTION_TIMELINE_MONTH_WINDOW_DEFAULT = 12;
const CONTRIBUTION_TIMELINE_MONTH_WINDOW_CONSTRAINED = 8;
const ABRA_CONTRIBUTION_SAMPLE_LIMIT = 24;
const CONTRIBUTION_CARDS_REGION_ID = "contributions-cards-region";

export function ContributionsPageClient() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact">("Newest");
  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(search);
  const deferredSort = useDeferredValue(sort);
  const constrainedNetwork = useNetworkConstraintPreference();
  const cardPageSize = constrainedNetwork
    ? CONTRIBUTION_CARD_PAGE_SIZE_CONSTRAINED
    : CONTRIBUTION_CARD_PAGE_SIZE_DEFAULT;
  const timelineMonthWindow = constrainedNetwork
    ? CONTRIBUTION_TIMELINE_MONTH_WINDOW_CONSTRAINED
    : CONTRIBUTION_TIMELINE_MONTH_WINDOW_DEFAULT;
  const [visibleCardCount, setVisibleCardCount] = useState(cardPageSize);
  const { data, isLoading, isError } = useContributions({
    filter: filterMap[deferredFilter],
    search: deferredSearch,
    sort: deferredSort,
  });
  const profile = data?.profile;
  const filteredRows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCardCount),
    [filteredRows, visibleCardCount],
  );
  const hasMoreRows = filteredRows.length > visibleRows.length;
  const remainingRows = Math.max(0, filteredRows.length - visibleRows.length);
  const isFiltering =
    deferredFilter !== filter || deferredSearch !== search || deferredSort !== sort;
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
  const monthly = useMemo(
    () => monthTimeline(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const monthlyWindow = useMemo(
    () => monthly.slice(-timelineMonthWindow),
    [monthly, timelineMonthWindow],
  );
  const topHighlights = useMemo(
    () =>
      [...deduplicateContributionRowsByPR(profile?.user.contributions ?? [])]
        .sort((left, right) => right.xpEarned - left.xpEarned)
        .slice(0, 3),
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
  }, [abraContributionSample, profile, repositories.length, streak.currentStreakDays]);

  const abraInsights = useAbraInsights(abraPayload);
  const maxMonthlyXp = Math.max(1, ...monthlyWindow.map((point) => point.xp));

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

  function handleClearCategoryFilter() {
    startTransition(() => {
      setFilter("All");
      setVisibleCardCount(cardPageSize);
    });
  }

  function handleClearSearchFilter() {
    startTransition(() => {
      setSearch("");
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
    <div className="space-y-6 [overflow-anchor:none]">
      <section id="contributions-filters" className="scroll-mt-24">
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
          onClearCategory={handleClearCategoryFilter}
          onClearSearch={handleClearSearchFilter}
          onClearSort={handleClearSortFilter}
        />
      </section>
      {isLoading ? <LoadingState message="Checking review depth and PR intensity..." /> : null}
      {isError ? (
        <ErrorState
          title="Contribution sync failed"
          description="GitHub data could not be refreshed. Retry or open settings."
          fallbackLabel="Open settings"
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
              ? "Try resetting filters or widening your search to recover cards from this scored evidence window."
              : "Start with a small real contribution: docs, tests, or a bug fix. Meaningful work unlocks the shelf."
          }
          actionLabel={isFilteredNoResults ? "Reset filters" : "Review quest queue"}
          actionHref={isFilteredNoResults ? undefined : "/dashboard/quests"}
          onAction={isFilteredNoResults ? handleResetFilters : undefined}
          secondaryActionLabel="Open settings"
          secondaryActionHref="/dashboard/settings"
          analyticsTarget={isFilteredNoResults ? "contributions:empty-filtered" : "contributions:empty"}
        />
      ) : null}
      {!isLoading && !isError ? (
        <section id="contributions-cards" className="render-opt-section scroll-mt-24 space-y-4">
          <SectionHeader
            eyebrow="Primary lane"
            title="Achievement cards"
            description="PR-by-PR impact evidence and narrative first."
          />
          <DeferUntilVisible fallback={<ContributionSectionPlaceholder title="Loading achievement card lane" />}>
            {filteredRows.length ? (
              <div className="space-y-4">
                <div id={CONTRIBUTION_CARDS_REGION_ID}>
                  <ContributionList
                    items={visibleRows}
                    narratives={abraInsights.data?.contributionNarratives}
                    isBusy={isFiltering}
                    totalCount={filteredRows.length}
                    startPosition={1}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
                    Showing {visibleRows.length} of {filteredRows.length} cards.
                  </p>
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
            ) : (
              <SubsectionEmptyState
                message="No contribution cards match this filter set yet. Reset filters or widen the PR evidence window."
                actionLabel="Open sync settings"
                actionHref="/dashboard/settings"
                onResetFilters={handleResetFilters}
              />
            )}
          </DeferUntilVisible>
        </section>
      ) : null}
      {!isLoading && !isError ? (
        <section id="contributions-repositories" className="render-opt-section scroll-mt-24">
          <details className="space-y-3" open={repositories.length > 0 && repositories.length <= 3}>
            <summary className="focus-ring neon-surface cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white marker:content-none">
              Repositories touched ({repositories.length})
            </summary>
            <DeferUntilVisible fallback={<ContributionSectionPlaceholder title="Loading repository impact lanes" />}>
              {repositories.length ? (
                <ul role="list" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {repositories.map((repository) => (
                    <li key={repository.fullName} className="render-opt-card neon-surface rounded-[1.4rem] border-cyan-300/28 px-4 py-3">
                      <p className="break-anywhere text-sm font-medium text-white">{repository.fullName}</p>
                      <p className="mt-1 text-xs text-muted">{repository.contributions} contributions</p>
                      <p className="mt-3 text-lg font-semibold text-cyan-200">{repository.totalXp} XP</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <SubsectionEmptyState
                  message="No repository contribution summary is available in this snapshot yet."
                  actionLabel="Open sync settings"
                  actionHref="/dashboard/settings"
                />
              )}
            </DeferUntilVisible>
          </details>
        </section>
      ) : null}
      {!isLoading && !isError ? (
        <section id="contributions-timeline" className="render-opt-section scroll-mt-24">
          <details className="space-y-4">
            <summary className="focus-ring neon-surface cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white marker:content-none">
              Timeline and highlights ({monthlyWindow.length} months, {topHighlights.length} top PRs)
            </summary>
            <DeferUntilVisible fallback={<ContributionSectionPlaceholder title="Loading timeline and highlights" />}>
              <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
                <GlowCard className="space-y-4 border border-fuchsia-400/20 bg-gradient-to-br from-slate-950/88 to-fuchsia-950/30">
                  <h3 className="cyber-title text-sm font-medium text-fuchsia-200">Contribution timeline</h3>
                  {monthlyWindow.length ? (
                    <div className="space-y-3">
                      <ul role="list" className="space-y-3">
                        {monthlyWindow.map((point) => (
                          <li key={point.month} className="list-none space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted">
                              <span>{point.month}</span>
                              <span>{point.xp} XP</span>
                            </div>
                            <div className="neon-track h-2 rounded-full">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300"
                                style={{ width: `${Math.max(8, Math.round((point.xp / maxMonthlyXp) * 100))}%` }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <SubsectionEmptyState
                      message="Timeline points are not available yet for this filtered evidence window."
                      actionLabel="Open sync settings"
                      actionHref="/dashboard/settings"
                    />
                  )}
                </GlowCard>
                <GlowCard className="space-y-4 border border-cyan-300/20 bg-gradient-to-br from-slate-950/88 to-cyan-950/25">
                  <h3 className="cyber-title text-sm font-medium text-cyan-200">Top highlights</h3>
                  {topHighlights.length ? (
                    <ul role="list" className="space-y-3">
                      {topHighlights.map((row, index) => (
                        <li
                          key={`${row.owner}/${row.repo}#${row.number}-${row.id}-${index}`}
                          className="list-none render-opt-card neon-surface space-y-2 rounded-2xl px-3 py-3"
                        >
                          <p className="break-anywhere text-sm font-medium text-white">{row.title}</p>
                          <p className="mt-1 break-anywhere text-xs text-muted">{row.owner}/{row.repo} #{row.number}</p>
                          <p className="mt-2 text-sm text-cyan-200">+{row.xpEarned} XP</p>
                          <div className="pt-1">
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/pr/${row.owner}/${row.repo}/${row.number}`} prefetch={false}>
                                View report
                              </Link>
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <SubsectionEmptyState
                      message="No high-signal highlights are available yet in this snapshot."
                      actionLabel="Open quest lane"
                      actionHref="/dashboard/quests"
                    />
                  )}
                </GlowCard>
              </div>
            </DeferUntilVisible>
          </details>
        </section>
      ) : null}
    </div>
  );
}

function ContributionSectionPlaceholder({ title }: { title: string }) {
  return (
    <GlowCard className="glass-panel cyber-card cyber-frame flex min-h-[11rem] items-center justify-center p-4">
      <p className="text-sm text-muted">{title}</p>
    </GlowCard>
  );
}

function SubsectionEmptyState({
  message,
  actionLabel,
  actionHref,
  onResetFilters,
}: {
  message: string;
  actionLabel: string;
  actionHref: string;
  onResetFilters?: () => void;
}) {
  return (
    <GlowCard className="neon-surface space-y-3 border-dashed border-primary/24 p-4 text-sm text-muted">
      <p>{message}</p>
      <div className="flex flex-wrap gap-2">
        {onResetFilters ? (
          <Button type="button" size="sm" variant="secondary" onClick={onResetFilters}>
            Reset filters
          </Button>
        ) : null}
        <Button asChild size="sm" variant="secondary">
          <Link href={actionHref} prefetch={false}>{actionLabel}</Link>
        </Button>
      </div>
    </GlowCard>
  );
}

function deduplicateContributionRowsByPR(rows: Contribution[]): Contribution[] {
  const bestByPR = new Map<string, Contribution>();

  for (const row of rows) {
    const key = `${row.owner}/${row.repo}#${row.number}`;
    const existing = bestByPR.get(key);
    if (!existing || row.xpEarned > existing.xpEarned) {
      bestByPR.set(key, row);
    }
  }

  return Array.from(bestByPR.values());
}
