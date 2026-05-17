"use client";

import { useMemo } from "react";
import { Award, CheckCircle2, GitPullRequest, ShieldCheck, Stars } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import { TimelineChart } from "@/components/shared/TimelineChart";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { BestPRsPanel } from "@/features/profile/components/BestPRsPanel";
import { PublicProfileHero } from "@/features/profile/components/PublicProfileHero";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useProfile } from "@/hooks/use-profile";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";

export function PublicProfilePageClient({
  username,
}: {
  username: string;
}) {
  const { data, isLoading, isError, isFetching, refetch } = useProfile(username);
  const streak = summarizeContributionStreak(data?.user.contributions ?? []);
  const abraPayload = useMemo(() => {
    if (!data) {
      return null;
    }
    return {
      profile: {
        username: data.user.username,
        displayName: data.user.displayName,
        currentTitle: data.user.title,
        rankTier: data.user.level.rankTier,
        level: data.user.level.currentLevel,
        totalXp: data.user.level.currentXp,
        mergedPrCount: data.user.mergedPrCount,
        strongestSignals: data.user.strongestSignals,
        repositoriesTouched: data.topRepositories.length,
        badgeCount: data.user.badges.filter((badge) => badge.unlocked).length,
        streakDays: streak.currentStreakDays,
      },
      contributions: data.user.contributions.slice(0, 8).map((row) => ({
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
      badges: data.user.badges.slice(0, 8).map((badge) => ({
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
  }, [data, streak.currentStreakDays]);
  const abraInsights = useAbraInsights(abraPayload);

  if (isLoading) {
    return <LoadingState message="Preparing public reputation card..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Profile unavailable"
        description="The public profile could not be loaded. Retry or return to the dashboard snapshot."
        fallbackLabel="Open dashboard"
        fallbackHref="/dashboard"
        analyticsTarget="public-profile:error"
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Profile unavailable"
        description="This profile is hidden, missing, or has not earned a public GitRank score yet."
        actionLabel="Open dashboard"
        actionHref="/dashboard"
        analyticsTarget="public-profile:empty"
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.isStale ? (
        <StaleState
          message={`This profile snapshot was refreshed ${formatRelativeDays(data.refreshedAt)}.`}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open dashboard"
          actionHref="/dashboard"
          analyticsTarget="public-profile:stale"
        />
      ) : null}
      <PublicProfileHero
        user={data.user}
        shareHeadline={data.shareHeadline}
        archetype={abraInsights.data?.archetype}
        identitySummary={abraInsights.data?.identitySummary}
        aiMode={abraInsights.data?.generatedBy}
      />
      <div className="neon-callout rounded-[1.75rem] px-4 py-3 text-sm text-slate-200">
        Public profiles summarize recent contribution evidence. Skill areas and repository rankings are snapshot-based signals, not absolute claims of expertise.
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total XP" value={data.user.gitRankScore} detail="The explainable score ledger currently served on this profile." icon={<Stars className="h-5 w-5 text-primary" />} />
        <StatCard label="Merged PRs" value={data.user.mergedPrCount} detail="Merged work is the core reputation primitive." icon={<GitPullRequest className="h-5 w-5 text-primary" />} />
        <StatCard label="Badges earned" value={data.user.badges.filter((badge) => badge.unlocked).length} detail="Verified contribution milestones, not vanity counters." icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
        <StatCard label="Consistency" value={`${data.user.consistencyScore}%`} detail={`Trend window: ${data.trendWindowLabel}`} icon={<CheckCircle2 className="h-5 w-5 text-primary" />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <GlowCard className="space-y-5">
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Badge showcase</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top unlocked badges</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.user.badges.filter((badge) => badge.unlocked).slice(0, 4).map((badge) => (
              <div key={badge.id} className="neon-surface rounded-[1.75rem] p-4">
                <RarityBadge rarity={badge.rarity} />
                <h3 className="mt-3 text-lg font-medium text-white">{badge.name}</h3>
                <p className="mt-2 text-sm text-muted">{badge.description}</p>
              </div>
            ))}
          </div>
        </GlowCard>
        <GlowCard className="space-y-5">
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Skill radar</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Strength map</h2>
          </div>
          <SkillRadarChart skills={data.user.skillTree} />
        </GlowCard>
      </div>
      <BestPRsPanel reports={data.featuredContributions} />
      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <GlowCard className="space-y-5">
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Contribution quality timeline</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{data.trendWindowLabel}</h2>
          </div>
          <TimelineChart data={data.user.xpTimeline} />
        </GlowCard>
        <GlowCard className="space-y-5">
          <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
            <Award className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Top repositories</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Where recent contribution signal is strongest</h2>
          </div>
          <div className="space-y-3">
            {data.topRepositories.length === 0 ? (
              <div className="neon-surface rounded-[1.5rem] border-dashed border-primary/24 px-4 py-3 text-sm text-muted">
                Repository-level signal is not available on this snapshot yet.
              </div>
            ) : (
              data.topRepositories.slice(0, 4).map((repository) => (
                <div key={repository.name} className="neon-surface rounded-[1.5rem] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{repository.name}</p>
                      <p className="text-sm text-muted">
                        {repository.contributionCount} scored contributions
                        {repository.primarySkill ? ` • ${repository.primarySkill}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs tracking-[0.24em] text-primary uppercase">XP</p>
                      <p className="mt-1 text-lg font-semibold text-white">{repository.totalXp}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlowCard>
      </div>
    </div>
  );
}
