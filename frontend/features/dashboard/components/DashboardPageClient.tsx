"use client";

import { useEffect, useMemo, useRef } from "react";
import { Activity, Medal, ShieldCheck } from "lucide-react";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { ContributionTimelineCard } from "@/features/dashboard/components/ContributionTimelineCard";
import { CurrentLeagueCard } from "@/features/dashboard/components/CurrentLeagueCard";
import { QuestPanel } from "@/features/dashboard/components/QuestPanel";
import { RecentBattleReports } from "@/features/dashboard/components/RecentBattleReports";
import { ScoreExplanationCard } from "@/features/dashboard/components/ScoreExplanationCard";
import { SkillBreakdownCard } from "@/features/dashboard/components/SkillBreakdownCard";
import { BadgeShelf } from "@/features/dashboard/components/BadgeShelf";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useDashboard } from "@/hooks/use-dashboard";
import { ErrorState } from "@/components/shared/ErrorState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { LoadingState } from "@/components/shared/LoadingState";
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
        description="The dashboard could not refresh. Retry or open settings."
        fallbackLabel="Open settings"
        fallbackHref="/dashboard/settings"
        analyticsTarget="dashboard:error"
      />
    );
  }

  return (
    <div className="space-y-6">
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
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="dashboard:stale"
        />
      ) : null}
      <section id="dashboard-hero" className="scroll-mt-24">
        <DashboardHeroRankCard
          user={user}
          archetype={abraInsights.data?.archetype ?? fallbackArchetype}
          identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
          aiMode={abraInsights.data?.generatedBy ?? "deterministic"}
        />
      </section>
      <section id="dashboard-snapshot" className="scroll-mt-24 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="GitRank score" value={user.gitRankScore} detail="Weighted contribution score." icon={<Medal className="h-5 w-5 text-primary" />} />
        <StatCard label="Merged PRs" value={user.mergedPrCount} detail="Verified merged work only." icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
        <StatCard
          label="PR evidence window"
          value={`${contributionWindowCount}/${contributionWindowCap}`}
          detail={`${contributionWindowFillRate}% of recent capped history.`}
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <StatCard label="Reviewed PRs" value={user.reviewedPrCount} detail="Review evidence in this snapshot." icon={<Activity className="h-5 w-5 text-primary" />} />
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="space-y-6">
          <section id="dashboard-league" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading league snapshot" />}>
              <CurrentLeagueCard user={user} />
            </DeferUntilVisible>
          </section>
          <section className="render-opt-section">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading quest board" />}>
              <QuestPanel quests={user.quests} />
            </DeferUntilVisible>
          </section>
        </div>
        <div className="space-y-6">
          <section id="dashboard-reports" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading battle reports" />}>
              <RecentBattleReports reports={recentReports} />
            </DeferUntilVisible>
          </section>
        </div>
      </div>
      <section id="dashboard-advanced" className="render-opt-section scroll-mt-24">
        <details className="space-y-5">
          <summary className="focus-ring neon-surface cursor-pointer list-none rounded-[1.4rem] px-4 py-3 text-sm font-semibold text-white marker:content-none">
            Advanced insights
          </summary>
          <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
            <section className="space-y-6">
              <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading score explanation" />}>
                <ScoreExplanationCard user={user} />
              </DeferUntilVisible>
              <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading badge shelf" />}>
                <BadgeShelf user={user} />
              </DeferUntilVisible>
            </section>
            <section className="space-y-6">
              <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading skill breakdown" />}>
                <SkillBreakdownCard
                  user={user}
                  skillInsights={abraInsights.data?.skillInsights}
                  aiMode={abraInsights.data?.generatedBy}
                />
              </DeferUntilVisible>
              <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading contribution timeline" />}>
                <ContributionTimelineCard user={user} />
              </DeferUntilVisible>
            </section>
          </div>
        </details>
      </section>
    </div>
  );
}

function SectionDeferredPlaceholder({ title }: { title: string }) {
  return (
    <div
      className="glass-panel cyber-card cyber-frame flex min-h-[12rem] items-center justify-center p-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-muted">{title}</p>
    </div>
  );
}
