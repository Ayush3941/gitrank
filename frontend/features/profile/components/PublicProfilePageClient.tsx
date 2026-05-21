"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Award, CheckCircle2, GitPullRequest, ShieldCheck, Stars } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import { TimelineChart } from "@/components/shared/TimelineChart";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { BestPRsPanel } from "@/features/profile/components/BestPRsPanel";
import { PublicProfileHero } from "@/features/profile/components/PublicProfileHero";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useProfile } from "@/hooks/use-profile";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
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
    if (
      !shouldRequestAbraInsights({
        showAiSummaries: data.user.privacy.showAiSummaries !== false,
        mergedPrCount: data.user.mergedPrCount,
        contributionCount: data.user.contributions.length,
      })
    ) {
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
  const fallbackArchetype = useMemo(
    () => (data ? deriveDeterministicArchetype(data.user.strongestSignals) : "Systems Builder"),
    [data],
  );
  const fallbackIdentitySummary = useMemo(() => {
    if (!data) {
      return undefined;
    }
    return buildDeterministicIdentitySummary({
      displayName: data.user.displayName,
      rankTier: data.user.level.rankTier,
      level: data.user.level.currentLevel,
      totalXp: data.user.level.currentXp,
      mergedPrCount: data.user.mergedPrCount,
      strongestSignals: data.user.strongestSignals,
      repositoriesTouched: data.topRepositories.length,
      streakDays: streak.currentStreakDays,
      isStale: data.isStale,
      trendWindowLabel: data.trendWindowLabel,
    });
  }, [data, streak.currentStreakDays]);

  if (isLoading) {
    return <LoadingState message="Loading public profile..." />;
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
        eyebrow="Public profile visibility"
        title="Profile unavailable"
        description="This profile is hidden, missing, or has not earned a public GitRank score yet."
        actionLabel="Open dashboard"
        actionHref="/dashboard"
        secondaryActionLabel="Open homepage"
        secondaryActionHref="/"
        analyticsTarget="public-profile:empty"
      />
    );
  }

  return (
    <div className="space-y-6">
      {data.isStale ? (
        <StaleState
          message={`This profile snapshot was refreshed ${formatRelativeDays(data.refreshedAt)}.`}
          updatedAt={data.refreshedAt}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open dashboard"
          actionHref="/dashboard"
          analyticsTarget="public-profile:stale"
        />
      ) : null}
      <section id="public-profile-overview" className="scroll-mt-24 space-y-6">
        <PublicProfileHero
          user={data.user}
          shareHeadline={data.shareHeadline}
          archetype={abraInsights.data?.archetype ?? fallbackArchetype}
          identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="GitRank score" value={data.user.gitRankScore} icon={<Stars className="h-5 w-5 text-primary" />} />
          <StatCard label="Merged PRs" value={data.user.mergedPrCount} icon={<GitPullRequest className="h-5 w-5 text-primary" />} />
          <StatCard label="Badges earned" value={data.user.badges.filter((badge) => badge.unlocked).length} icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
          <StatCard label="Consistency" value={`${data.user.consistencyScore}%`} detail={data.trendWindowLabel} icon={<CheckCircle2 className="h-5 w-5 text-primary" />} />
        </div>
      </section>
      <section id="public-profile-badges-skills" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PublicProfileSectionPlaceholder title="Loading badges and skills" />}>
          <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
            <GlowCard className="space-y-5">
              <div>
                <p className="text-xs font-medium text-primary">Badges</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Top unlocked</h2>
              </div>
              <ul role="list" className="grid gap-3 sm:grid-cols-2">
                {data.user.badges.filter((badge) => badge.unlocked).slice(0, 4).map((badge) => (
                  <li key={badge.id} className="render-opt-card neon-surface rounded-[1.75rem] p-4">
                    <RarityBadge rarity={badge.rarity} />
                    <h3 className="mt-3 text-lg font-medium text-white">{badge.name}</h3>
                    <ExpandableText
                      text={badge.description}
                      lines={3}
                      minLengthForToggle={120}
                      className="mt-2"
                      textClassName="text-sm text-muted"
                      showMoreLabel="More"
                      showLessLabel="Less"
                    />
                  </li>
                ))}
              </ul>
            </GlowCard>
            <GlowCard className="space-y-5">
              <div>
                <p className="text-xs font-medium text-primary">Skills</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Strength map</h2>
              </div>
              <SkillRadarChart skills={data.user.skillTree} />
            </GlowCard>
          </div>
        </DeferUntilVisible>
      </section>
      <section id="public-profile-best-prs" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PublicProfileSectionPlaceholder title="Loading best PR battle reports" />}>
          <BestPRsPanel reports={data.featuredContributions} />
        </DeferUntilVisible>
      </section>
      <section id="public-profile-timeline-repos" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PublicProfileSectionPlaceholder title="Loading timeline and repositories" />}>
          <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
            <GlowCard className="space-y-5">
              <div>
                <p className="text-xs font-medium text-primary">Timeline</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{data.trendWindowLabel}</h2>
              </div>
              <TimelineChart data={data.user.xpTimeline} />
            </GlowCard>
            <GlowCard className="space-y-5">
              <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary">Top repositories</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Recent strongest lanes</h2>
              </div>
              <div className="space-y-3">
                {data.topRepositories.length === 0 ? (
                  <div className="neon-surface rounded-[1.5rem] border-dashed border-primary/24 px-4 py-3 text-sm text-muted">
                    <p>Repository-level signal is not available on this snapshot yet.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <Link href="/dashboard/contributions" prefetch={false}>Open contributions</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/dashboard/settings" prefetch={false}>Open sync settings</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul role="list" className="space-y-3">
                    {data.topRepositories.slice(0, 4).map((repository, index) => (
                      <li key={`${repository.name}-${index}`} className="render-opt-card neon-surface rounded-[1.5rem] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="break-anywhere font-medium text-white">{repository.name}</p>
                            <p className="break-anywhere text-sm text-muted">
                              {repository.contributionCount} scored contributions
                              {repository.primarySkill ? ` • ${repository.primarySkill}` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-medium text-primary">XP</p>
                            <p className="mt-1 text-lg font-semibold text-white">{repository.totalXp}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlowCard>
          </div>
        </DeferUntilVisible>
      </section>
    </div>
  );
}

function PublicProfileSectionPlaceholder({ title }: { title: string }) {
  return (
    <GlowCard className="space-y-4">
      <p className="text-xs font-medium text-primary">{title}</p>
      <div className="neon-skeleton h-8 w-2/3 rounded-[0.1rem]" />
      <div className="space-y-2">
        <div className="neon-skeleton h-4 w-full rounded-[0.1rem]" />
        <div className="neon-skeleton h-4 w-11/12 rounded-[0.1rem]" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="neon-skeleton h-24 rounded-[0.1rem]" />
        <div className="neon-skeleton h-24 rounded-[0.1rem]" />
      </div>
    </GlowCard>
  );
}
