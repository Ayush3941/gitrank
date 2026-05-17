"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Activity, Flame, Medal, ShieldCheck, Swords } from "lucide-react";
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
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
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
    return <LoadingState message="Building your RPG dashboard..." />;
  }

  if (isError || !data || !user) {
    return (
      <ErrorState
        title="Dashboard sync failed"
        description="GitHub rate limits or AI analysis delays can leave the dashboard partially unavailable. Retry or fall back to the last verified profile."
        fallbackLabel="Open settings"
        fallbackHref="/dashboard/settings"
        analyticsTarget="dashboard:error"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command center"
        description="Snapshot-based contribution analytics, progression, and score explanations weighted toward meaningful merged work."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/settings">Sync and privacy</Link>
          </Button>
        )}
      />
      {user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Your GitRank profile was refreshed ${formatRelativeDays(
            data.refreshedAt,
          )}.`}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="dashboard:stale"
        />
      ) : null}
      <DashboardHeroRankCard
        user={user}
        archetype={abraInsights.data?.archetype}
        identitySummary={abraInsights.data?.identitySummary}
        aiMode={abraInsights.data?.generatedBy}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="GitRank score" value={user.gitRankScore} detail="Weighted by impact, reviews, tests, and repository context." icon={<Medal className="h-5 w-5 text-primary" />} />
        <StatCard label="Merged PRs" value={user.mergedPrCount} detail="Only verified merged work receives full progression value." icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
        <StatCard
          label="PR evidence window"
          value={`${contributionWindowCount}/${contributionWindowCap}`}
          detail={`Current profile includes ${contributionWindowFillRate}% of the capped recent PR history window.`}
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Current streak"
          value={`${streak.currentStreakDays}d`}
          detail={`Best streak ${streak.bestStreakDays} days • active days this year ${streak.activeDaysThisYear}.`}
          icon={<Flame className="h-5 w-5 text-primary" />}
        />
        <StatCard label="Reviewed PRs" value={user.reviewedPrCount} detail="Review participation increases trust and unlocks deeper quests." icon={<Activity className="h-5 w-5 text-primary" />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="space-y-6">
          <CurrentLeagueCard user={user} />
          <QuestPanel quests={user.quests} />
          <ScoreExplanationCard user={user} />
        </div>
        <div className="space-y-6">
          <SkillBreakdownCard
            user={user}
            skillInsights={abraInsights.data?.skillInsights}
            aiMode={abraInsights.data?.generatedBy}
          />
          <RecentBattleReports reports={recentReports} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <BadgeShelf user={user} />
        <ContributionTimelineCard user={user} />
      </div>
      <StatCard
        label="Anti-spam rule"
        value="Meaning over volume"
        detail="Spam PRs do not make you powerful here. Thin unreviewed work gets penalized or capped."
        icon={<Swords className="h-5 w-5 text-primary" />}
      />
    </div>
  );
}
