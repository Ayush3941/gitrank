"use client";

import Link from "next/link";
import { Flame, Radar, Sparkles, Swords } from "lucide-react";
import { startTransition, useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionJumpNav } from "@/components/shared/SectionJumpNav";
import { SectionHeader } from "@/components/shared/SectionHeader";
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
import { initialSectionFromHash } from "@/lib/section-nav";

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

type ContributionSectionID =
  | "contributions-filters"
  | "contributions-overview"
  | "contributions-repositories"
  | "contributions-timeline"
  | "contributions-cards";

const CONTRIBUTION_SECTION_ITEMS: Array<{ id: ContributionSectionID; label: string }> = [
  { id: "contributions-filters", label: "Filters" },
  { id: "contributions-overview", label: "Overview" },
  { id: "contributions-repositories", label: "Repos" },
  { id: "contributions-timeline", label: "Timeline" },
  { id: "contributions-cards", label: "Cards" },
];
const CONTRIBUTION_SECTION_IDS = CONTRIBUTION_SECTION_ITEMS.map(
  (section) => section.id,
) as ContributionSectionID[];
const CONTRIBUTION_DEFAULT_SECTION: ContributionSectionID = "contributions-filters";

export function ContributionsPageClient() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact">("Newest");
  const [activeSection, setActiveSection] =
    useState<ContributionSectionID>(CONTRIBUTION_DEFAULT_SECTION);
  const deferredFilter = useDeferredValue(filter);
  const deferredSearch = useDeferredValue(search);
  const deferredSort = useDeferredValue(sort);
  const { data, isLoading, isError, isFetching, refetch } = useContributions({
    filter: filterMap[deferredFilter],
    search: deferredSearch,
    sort: deferredSort,
  });
  const profile = data?.profile;
  const filteredRows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const isFiltering =
    deferredFilter !== filter || deferredSearch !== search || deferredSort !== sort;
  const canReset = filter !== "All" || search.trim().length > 0 || sort !== "Newest";
  const activeSectionLabel =
    CONTRIBUTION_SECTION_ITEMS.find((section) => section.id === activeSection)?.label ??
    "Filters";
  const activeSectionLink = `/dashboard/contributions#${activeSection}`;

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      const nextSection = initialSectionFromHash(
        CONTRIBUTION_SECTION_IDS,
        CONTRIBUTION_DEFAULT_SECTION,
        window.location.hash,
      );
      setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const nextSection = initialSectionFromHash(
          CONTRIBUTION_SECTION_IDS,
          CONTRIBUTION_DEFAULT_SECTION,
          `#${visible.target.id}`,
        );
        setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    CONTRIBUTION_SECTION_ITEMS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      observer.disconnect();
    };
  }, []);

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

  function handleClearCategoryFilter() {
    startTransition(() => setFilter("All"));
  }

  function handleClearSearchFilter() {
    startTransition(() => setSearch(""));
  }

  function handleClearSortFilter() {
    startTransition(() => setSort("Newest"));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contributions"
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
          updatedAt={profile.refreshedAt}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
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
      <SectionJumpNav
        navLabelID="contributions-jump-nav-label"
        activeSectionLabel={activeSectionLabel}
        items={CONTRIBUTION_SECTION_ITEMS}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
        copyHref={activeSectionLink}
        copyAnalyticsTarget="contributions/copy-section-link"
      />
      <section id="contributions-filters" className="scroll-mt-24">
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
          onClearCategory={handleClearCategoryFilter}
          onClearSearch={handleClearSearchFilter}
          onClearSort={handleClearSortFilter}
        />
      </section>
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
        <section id="contributions-overview" className="scroll-mt-24">
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
                <ExpandableText
                  text={
                    abraInsights.data?.identitySummary ||
                    "Signal synthesis is running in deterministic mode while contribution intelligence resolves."
                  }
                  lines={4}
                  minLengthForToggle={220}
                  className="mt-2 max-w-3xl"
                  textClassName="break-anywhere text-sm text-slate-200/85"
                />
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
        </section>
      ) : null}
      {!isLoading && !isError ? (
        <section id="contributions-repositories" className="scroll-mt-24 space-y-3">
          <SectionHeader
            eyebrow="Repositories"
            title="Repositories touched"
            description="Where contribution effort concentrated in this scored evidence window."
          />
          {repositories.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {repositories.map((repository) => (
                <div key={repository.fullName} className="render-opt-card neon-surface rounded-[1.4rem] border-cyan-300/28 px-4 py-3">
                  <p className="break-anywhere text-sm font-medium text-white">{repository.fullName}</p>
                  <p className="mt-1 text-xs text-slate-300">{repository.contributions} contributions</p>
                  <p className="mt-3 text-lg font-semibold text-cyan-200">{repository.totalXp} XP</p>
                </div>
              ))}
            </div>
          ) : (
            <SubsectionEmptyState
              message="No repository contribution summary is available in this snapshot yet."
              actionLabel="Open sync settings"
              actionHref="/dashboard/settings"
            />
          )}
        </section>
      ) : null}
      {!isLoading && !isError ? (
        <section id="contributions-timeline" className="scroll-mt-24 space-y-4">
          <SectionHeader
            eyebrow="History"
            title="Contribution timeline and highlights"
            description="Momentum and top-impact snapshots from the current PR evidence window."
          />
          <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
          <GlowCard className="space-y-4 border border-fuchsia-400/20 bg-gradient-to-br from-slate-950/88 to-fuchsia-950/30">
            <h3 className="cyber-title text-sm tracking-[0.2em] text-fuchsia-200 uppercase">Contribution timeline</h3>
            {monthly.length ? (
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
            ) : (
              <SubsectionEmptyState
                message="Timeline points are not available yet for this filtered evidence window."
                actionLabel="Open sync settings"
                actionHref="/dashboard/settings"
              />
            )}
          </GlowCard>
          <GlowCard className="space-y-4 border border-cyan-300/20 bg-gradient-to-br from-slate-950/88 to-cyan-950/25">
            <h3 className="cyber-title text-sm tracking-[0.2em] text-cyan-200 uppercase">Top highlights</h3>
            {topHighlights.length ? (
              <div className="space-y-3">
                {topHighlights.map((row) => (
                  <div key={row.id} className="render-opt-card neon-surface rounded-2xl px-3 py-3">
                    <p className="break-anywhere text-sm font-medium text-white">{row.title}</p>
                    <p className="mt-1 break-anywhere text-xs text-slate-300">{row.owner}/{row.repo} #{row.number}</p>
                    <p className="mt-2 text-sm text-cyan-200">+{row.xpEarned} XP</p>
                  </div>
                ))}
              </div>
            ) : (
              <SubsectionEmptyState
                message="No high-signal highlights are available yet in this snapshot."
                actionLabel="Open quest lane"
                actionHref="/dashboard/quests"
              />
            )}
          </GlowCard>
          </div>
        </section>
      ) : null}
      {!isLoading && !isError ? (
        <section id="contributions-cards" className="scroll-mt-24 space-y-4">
          <SectionHeader
            eyebrow="PR cards"
            title="Achievement cards"
            description="Per-PR score signal, evidence tags, and impact narrative prepared for profile and presentation use."
          />
          {filteredRows.length ? (
            <ContributionList
              items={filteredRows}
              narratives={abraInsights.data?.contributionNarratives}
              isBusy={isFiltering}
            />
          ) : (
            <SubsectionEmptyState
              message="No contribution cards match this filter set yet. Reset filters or widen the PR evidence window."
              actionLabel="Open sync settings"
              actionHref="/dashboard/settings"
              onResetFilters={handleResetFilters}
            />
          )}
        </section>
      ) : null}
    </div>
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
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </GlowCard>
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
