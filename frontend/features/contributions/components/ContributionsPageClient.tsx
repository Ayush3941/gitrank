"use client";

import Link from "next/link";
import { Flame, Radar, Sparkles, Swords } from "lucide-react";
import { startTransition, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { ContributionList } from "@/features/contributions/components/ContributionList";
import { useContributions } from "@/hooks/use-contributions";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { Button } from "@/components/ui/button";
import { formatRelativeDays } from "@/lib/formatters";
import {
  monthTimeline,
  summarizeContributionStreak,
  summarizeRepositories,
  uniqueContributionDayCount,
} from "@/lib/metrics/contribution-metrics";

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

export function ContributionsPageClient() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact">("Newest");
  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(search);
  const deferredSort = useDeferredValue(sort);
  const { data, isLoading, isError } = useContributions({
    filter: filterMap[deferredFilter],
    search: deferredSearch,
    sort: deferredSort,
  });
  const profile = data?.profile;
  const filteredRows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const isFiltering =
    deferredFilter !== filter || deferredSearch !== search || deferredSort !== sort;
  const canReset = filter !== "All" || search.trim().length > 0 || sort !== "Newest";

  const streak = useMemo(
    () => summarizeContributionStreak(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const repositories = useMemo(
    () => summarizeRepositories(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const monthly = useMemo(
    () => monthTimeline(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );
  const topHighlights = useMemo(
    () =>
      [...(profile?.user.contributions ?? [])]
        .sort((left, right) => right.xpEarned - left.xpEarned)
        .slice(0, 3),
    [profile?.user.contributions],
  );
  const uniqueDays = useMemo(
    () => uniqueContributionDayCount(profile?.user.contributions ?? []),
    [profile?.user.contributions],
  );

  const abraPayload = useMemo(() => {
    if (!profile) {
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
      contributions: filteredRows.map((row) => ({
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
  }, [filteredRows, profile, repositories.length, streak.currentStreakDays]);

  const abraInsights = useAbraInsights(abraPayload);
  const maxMonthlyXp = Math.max(1, ...monthly.map((point) => point.xp));

  function handleFilterChange(next: string) {
    startTransition(() => setFilter(next));
  }

  function handleSearchChange(next: string) {
    startTransition(() => setSearch(next));
  }

  function handleSortChange(next: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact") {
    startTransition(() => setSort(next));
  }

  function handleResetFilters() {
    startTransition(() => {
      setFilter("All");
      setSearch("");
      setSort("Newest");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contribution drill-down"
        description="Achievement-grade contribution intelligence with score signals, timeline momentum, and AI-ready impact copy."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/settings">Sync settings</Link>
          </Button>
        )}
      />
      {profile?.user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Contribution snapshot refreshed ${formatRelativeDays(
            profile.refreshedAt,
          )}. New PR evidence may still be syncing.`}
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="contributions:stale"
        />
      ) : null}
      {profile ? (
        <div className="neon-callout rounded-[1.5rem] px-4 py-3 text-sm text-slate-200">
          Contribution window: latest {profile.user.contributions.length} scored PR-linked events (capped at 100 by backend profile history projection).
        </div>
      ) : null}
      <ContributionFilters
        value={filter}
        onValueChange={handleFilterChange}
        search={search}
        onSearchChange={handleSearchChange}
        sort={sort}
        onSortChange={handleSortChange}
        resultCount={filteredRows.length}
        isFiltering={isFiltering}
        canReset={canReset}
        onReset={handleResetFilters}
      />
      {isLoading ? <LoadingState message="Checking review depth and PR intensity..." /> : null}
      {isError ? (
        <ErrorState
          title="Contribution sync failed"
          description="GitHub rate limit reached or the PR analysis cache expired. Retry or inspect the last synced profile snapshot."
          fallbackLabel="Open settings"
          fallbackHref="/dashboard/settings"
          analyticsTarget="contributions:error"
        />
      ) : null}
      {!isLoading && !isError && filteredRows.length === 0 ? (
        <EmptyState
          title="No merged PRs found yet."
          description="Start with a small real contribution: docs, tests, or a bug fix. Meaningful work unlocks the shelf."
          actionLabel="Review quest queue"
          actionHref="/dashboard/quests"
          analyticsTarget="contributions:empty"
        />
      ) : null}
      {!isLoading && !isError && profile ? (
        <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
          <div className="cyber-hero-overlay pointer-events-none absolute inset-0" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-[0.24em] text-cyan-100 uppercase">
                  <Radar className="h-3.5 w-3.5" />
                  Contribution Ops
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {abraInsights.data?.archetype || "Systems Builder"} mode
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-200/85">
                  {abraInsights.data?.identitySummary ||
                    "Signal synthesis is running in deterministic mode while contribution intelligence resolves."}
                </p>
              </div>
              <div className="neon-chip neon-chip-mythic inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                {abraInsights.data?.generatedBy === "gemini"
                  ? "Gemini impact synthesis enabled"
                  : "Deterministic fallback active"}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Current streak" value={`${streak.currentStreakDays}d`} icon={<Flame className="h-4 w-4 text-orange-300" />} />
              <Metric label="Best streak" value={`${streak.bestStreakDays}d`} icon={<Flame className="h-4 w-4 text-fuchsia-300" />} />
              <Metric label="Active days (year)" value={streak.activeDaysThisYear} icon={<Swords className="h-4 w-4 text-cyan-200" />} />
              <Metric label="Unique contribution days" value={uniqueDays} icon={<Sparkles className="h-4 w-4 text-violet-200" />} />
            </div>
          </div>
        </GlowCard>
      ) : null}
      {!isLoading && !isError && repositories.length ? (
        <section className="space-y-3">
          <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">Repositories touched</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {repositories.map((repository) => (
              <div key={repository.fullName} className="neon-surface rounded-[1.4rem] border-cyan-300/28 px-4 py-3">
                <p className="text-sm font-medium text-white">{repository.fullName}</p>
                <p className="mt-1 text-xs text-slate-300">{repository.contributions} contributions</p>
                <p className="mt-3 text-lg font-semibold text-cyan-200">{repository.totalXp} XP</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {!isLoading && !isError && monthly.length ? (
        <section className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <GlowCard className="space-y-4 border border-fuchsia-400/20 bg-gradient-to-br from-slate-950/88 to-fuchsia-950/30">
            <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">Contribution timeline</p>
            <div className="space-y-3">
              {monthly.map((point) => (
                <div key={point.month} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-200">
                    <span>{point.month}</span>
                    <span>{point.xp} XP</span>
                  </div>
                  <div className="neon-track h-2 rounded-full">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-300 shadow-[0_0_18px_rgba(147,197,253,0.45)]"
                      style={{ width: `${Math.max(8, Math.round((point.xp / maxMonthlyXp) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlowCard>
          <GlowCard className="space-y-4 border border-cyan-300/20 bg-gradient-to-br from-slate-950/88 to-cyan-950/25">
            <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">Top highlights</p>
            <div className="space-y-3">
              {topHighlights.map((row) => (
                <div key={row.id} className="neon-surface rounded-2xl px-3 py-3">
                  <p className="text-sm font-medium text-white">{row.title}</p>
                  <p className="mt-1 text-xs text-slate-300">{row.owner}/{row.repo} #{row.number}</p>
                  <p className="mt-2 text-sm text-cyan-200">+{row.xpEarned} XP</p>
                </div>
              ))}
            </div>
          </GlowCard>
        </section>
      ) : null}
      {!isLoading && !isError && filteredRows.length ? (
        <ContributionList
          items={filteredRows}
          narratives={abraInsights.data?.contributionNarratives}
          isBusy={isFiltering}
        />
      ) : null}
    </div>
  );
}

function Metric({
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
      <p className="text-[11px] tracking-[0.2em] text-slate-300 uppercase">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        {value}
        {icon}
      </p>
    </div>
  );
}
