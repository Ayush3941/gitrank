"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Activity, Flame, Medal } from "lucide-react";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { GlowCard } from "@/components/shared/GlowCard";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useDashboard } from "@/hooks/use-dashboard";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import { formatRelativeDays } from "@/lib/formatters";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const CurrentLeagueCard = dynamic(
  () =>
    import("@/features/dashboard/components/CurrentLeagueCard").then(
      (mod) => mod.CurrentLeagueCard,
    ),
  {
    loading: () => <LazyLanePlaceholder label="Loading league" />,
  },
);

const QuestPanel = dynamic(
  () =>
    import("@/features/dashboard/components/QuestPanel").then(
      (mod) => mod.QuestPanel,
    ),
  {
    loading: () => <LazyLanePlaceholder label="Loading quests" />,
  },
);

const RecentBattleReports = dynamic(
  () =>
    import("@/features/dashboard/components/RecentBattleReports").then(
      (mod) => mod.RecentBattleReports,
    ),
  {
    loading: () => <LazyLanePlaceholder label="Loading reports" />,
  },
);

export function DashboardPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useDashboard();
  const scoreExplanationEventSent = useRef(false);
  const user = data?.user;
  const recentReports = data?.recentReports ?? [];
  const streak = useMemo(
    () => summarizeContributionStreak(user?.contributions ?? []),
    [user?.contributions],
  );
  const contributionWindowCap = 100;
  const contributionWindowCount = Math.min(
    user?.contributions.length ?? 0,
    contributionWindowCap,
  );
  const contributionWindowFillRate =
    contributionWindowCap > 0
      ? Math.round((contributionWindowCount / contributionWindowCap) * 100)
      : 0;
  const reportHealth = summarizeReportHealth(recentReports);
  const abraPayload = useMemo(() => {
    if (!user) {
      return null;
    }
    if (
      !shouldRequestAbraInsights({
        showAiSummaries: user.privacy.showAiSummaries !== false,
        mergedPrCount: user.mergedPrCount,
        contributionCount: user.contributions.length,
      })
    ) {
      return null;
    }
    const visibleBadges = deduplicateBadgesByName(user.badges);
    return {
      profile: {
        username: user.username,
        displayName: user.displayName,
        currentTitle: user.title,
        rankTier: user.level.rankTier,
        level: user.level.currentLevel,
        totalXp: user.level.currentXp,
        mergedPrCount: user.mergedPrCount,
        strongestSignals: user.strongestSignals,
        repositoriesTouched: user.repositories.length,
        badgeCount: visibleBadges.filter((badge) => badge.unlocked).length,
        streakDays: streak.currentStreakDays,
      },
      contributions: user.contributions.slice(0, 8).map((row) => ({
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
  }, [streak.currentStreakDays, user]);
  const abraInsights = useAbraInsights(abraPayload);
  const fallbackArchetype = useMemo(
    () => (user ? deriveDeterministicArchetype(user.strongestSignals) : "Systems Builder"),
    [user],
  );
  const fallbackIdentitySummary = useMemo(() => {
    if (!data || !user) {
      return undefined;
    }
    return buildDeterministicIdentitySummary({
      displayName: user.displayName,
      rankTier: user.level.rankTier,
      level: user.level.currentLevel,
      totalXp: user.level.currentXp,
      mergedPrCount: user.mergedPrCount,
      strongestSignals: user.strongestSignals,
      repositoriesTouched: user.repositories.length,
      streakDays: streak.currentStreakDays,
      isStale: data.isStale,
      trendWindowLabel: data.trendWindowLabel,
    });
  }, [data, streak.currentStreakDays, user]);

  useEffect(() => {
    if (isLoading || isError || !data || scoreExplanationEventSent.current) {
      return;
    }
    scoreExplanationEventSent.current = true;
    void emitAnalyticsEvent({
      eventName: "score_explanation.opened",
      source: "frontend",
      target: "dashboard",
      status: "success",
    });
  }, [data, isError, isLoading]);

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (isError || !data || !user) {
    return (
      <ErrorState
        title="Dashboard sync failed"
        description="The dashboard could not refresh. Retry or open sync settings."
        onRetry={() => {
          void refetch();
        }}
        fallbackLabel="Open sync settings"
        fallbackHref="/dashboard/settings"
        analyticsTarget="dashboard:error"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description="Live contributor snapshot from merged PR evidence."
        actions={(
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/contributions" prefetch={false}>
              View PR cards
            </Link>
          </Button>
        )}
      />
      {user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Your GitRank profile was refreshed ${formatRelativeDays(
            data.refreshedAt,
          )}.`}
          updatedAt={data.refreshedAt}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="dashboard:stale"
        />
      ) : null}
      <section>
        <GlowCard className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-primary">Signal health</p>
            <p className="text-xs text-muted">Status updates for sync, evidence, and report mode.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="neon-surface rounded-[1rem] px-3 py-3">
              <p className="text-xs font-medium text-primary">Sync state</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatSyncStateLabel(user.syncStatus.state)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {user.syncStatus.lastSyncedAt
                  ? `Last sync ${formatRelativeDays(user.syncStatus.lastSyncedAt)}.`
                  : "No sync timestamp yet."}
              </p>
            </div>
            <div className="neon-surface rounded-[1rem] px-3 py-3">
              <p className="text-xs font-medium text-primary">Evidence coverage</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {contributionWindowCount}/{contributionWindowCap} rows
              </p>
              <p className="mt-1 text-xs text-muted">{contributionWindowFillRate}% of the capped window loaded.</p>
            </div>
            <div className="neon-surface rounded-[1rem] px-3 py-3">
              <p className="text-xs font-medium text-primary">Report mode</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{reportHealth.label}</p>
              <p className="mt-1 text-xs text-muted">{reportHealth.hint}</p>
            </div>
          </div>
        </GlowCard>
      </section>
      <section>
        <DashboardHeroRankCard
          user={user}
          archetype={abraInsights.data?.archetype ?? fallbackArchetype}
          identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
          aiMode={abraInsights.data?.generatedBy ?? "deterministic"}
        />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <StatCard
          className="xl:col-span-6"
          valueClassName="text-4xl"
          label="GitRank score"
          value={user.gitRankScore}
          detail="Impact-weighted score from merged evidence."
          icon={<Medal className="h-5 w-5 text-primary" />}
        />
        <GlowCard className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm">Current streak</span>
            <span className="hud-pill rounded-2xl p-2">
              <Flame className="h-5 w-5 text-primary" />
            </span>
          </div>
          <div className="numeric-readout text-3xl font-semibold tracking-tight">
            {streak.currentStreakDays}d
          </div>
          <p className="text-sm leading-6 text-muted">
            Best {streak.bestStreakDays}d • {streak.activeDaysThisYear} active days this year
          </p>
        </GlowCard>
        <GlowCard className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm">Evidence window</span>
            <span className="hud-pill rounded-2xl p-2">
              <Activity className="h-5 w-5 text-primary" />
            </span>
          </div>
          <div className="numeric-readout text-3xl font-semibold tracking-tight">
            {contributionWindowCount}/{contributionWindowCap}
          </div>
          <div className="space-y-2">
            <Progress value={contributionWindowFillRate} />
            <p className="text-sm leading-6 text-muted">
              {contributionWindowFillRate}% of the capped recent PR evidence window is loaded.
            </p>
          </div>
        </GlowCard>
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.86fr,1.14fr]">
        <div className="space-y-6">
          <section className="render-opt-section">
            <CurrentLeagueCard user={user} />
          </section>
          <section className="render-opt-section">
            <QuestPanel quests={user.quests} />
          </section>
        </div>
        <div className="space-y-6">
          <section className="render-opt-section">
            <RecentBattleReports reports={recentReports} />
          </section>
        </div>
      </div>
    </div>
  );
}

function LazyLanePlaceholder({ label }: { label: string }) {
  return (
    <GlowCard className="min-h-[15rem] space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-10 w-3/5" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}

function summarizeReportHealth(reports: Array<{ evidenceState: { status: string } }>): {
  label: string;
  hint: string;
} {
  if (reports.length === 0) {
    return {
      label: "No report evidence yet",
      hint: "Run sync and open contributions to generate report cards.",
    };
  }

  const statuses = reports.map((report) => report.evidenceState.status);
  if (statuses.some((status) => status === "stale" || status === "incomplete")) {
    return {
      label: "Partial evidence",
      hint: "Some reports are stale or incomplete. Refresh sync in Settings.",
    };
  }
  if (statuses.some((status) => status === "rate_limited")) {
    return {
      label: "Rate-limited",
      hint: "GitHub/AI limits are active. Retry after cooldown.",
    };
  }
  if (statuses.some((status) => status === "deterministic_only" || status === "ai_fallback")) {
    return {
      label: "Deterministic mode",
      hint: "Scoring is valid. Gemini enrichment will attach when available.",
    };
  }
  return {
    label: "Gemini-ready",
    hint: "Reports include complete synced evidence and AI enrichment.",
  };
}

function formatSyncStateLabel(state: string): string {
  if (state === "synced") return "Synced";
  if (state === "syncing") return "Syncing";
  if (state === "stale") return "Stale";
  if (state === "failed") return "Failed";
  if (state === "rate_limited") return "Rate-limited";
  if (state === "partially_synced") return "Partial sync";
  return "Not synced yet";
}
