"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Activity, Flame, Medal } from "lucide-react";
import { CurrentLeagueCard } from "@/features/dashboard/components/CurrentLeagueCard";
import { QuestPanel } from "@/features/dashboard/components/QuestPanel";
import { RecentBattleReports } from "@/features/dashboard/components/RecentBattleReports";
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
import { Button } from "@/components/ui/button";

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
        badgeCount: user.badges.filter((badge) => badge.unlocked).length,
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
      badges: user.badges.slice(0, 8).map((badge) => ({
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
    return <LoadingState message="Loading dashboard snapshot..." />;
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
        description="Rank, XP, and contribution signals."
        actions={(
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/contributions" prefetch={false}>
              Open contributions
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
          detail="Impact-weighted score from merged contribution evidence."
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
          <ul role="list" className="space-y-2 text-sm text-muted">
            <li className="flex items-center justify-between gap-3">
              <span>Merged PRs</span>
              <span className="text-white">{user.mergedPrCount}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Reviewed PRs</span>
              <span className="text-white">{user.reviewedPrCount}</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>Loaded</span>
              <span className="text-white">{contributionWindowFillRate}%</span>
            </li>
          </ul>
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
