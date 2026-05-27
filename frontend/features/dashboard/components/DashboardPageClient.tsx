"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Activity, Flame, Medal } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useDashboard } from "@/hooks/use-dashboard";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { ErrorState } from "@/components/shared/ErrorState";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
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
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
import {
  deriveEffectiveSyncState,
  shouldShowSyncRefreshPill,
} from "@/lib/presentation/sync-evidence";
import { buildUserSyncRefreshFeedback } from "@/lib/sync-refresh-feedback";
import { Button } from "@/components/ui/button";

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
  const constrainedNetwork = useNetworkConstraintPreference();
  const { data, isLoading, isError, refetch } = useDashboard();
  const runUserSync = useRunUserSync();
  const scoreExplanationEventSent = useRef(false);
  const user = data?.user;
  const recentReports = data?.recentReports ?? [];
  const streak = useMemo(
    () => summarizeContributionStreak(user?.contributions ?? []),
    [user?.contributions],
  );
  const syncStateForDisplay = useMemo(() => deriveEffectiveSyncState(user), [user]);
  const showRefreshPill = useMemo(() => shouldShowSyncRefreshPill(user), [user]);
  const abraPayload = useMemo(() => {
    if (!user) {
      return null;
    }
    if (constrainedNetwork) {
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
  }, [constrainedNetwork, streak.currentStreakDays, user]);
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
        description="Dashboard refresh failed. Retry or open sync settings."
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
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description="Identity, progression, and report lanes."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Rank ${user.level.rankTier}` },
              { label: `Merged PRs ${user.mergedPrCount.toLocaleString("en-US")}` },
              { label: `Streak ${streak.currentStreakDays}d` },
              {
                label: `Sync ${formatSyncStateLabel(syncStateForDisplay)}`,
                tone: toneForSyncState(syncStateForDisplay),
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            {showRefreshPill ? (
              <SnapshotFreshnessPill refreshedAt={data.refreshedAt} label="Refreshed" />
            ) : (
              <span
                className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                title="No scored PR evidence has been materialized yet."
              >
                Evidence pending
              </span>
            )}
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/contributions" prefetch={false}>
                View PR cards
              </Link>
            </Button>
          </div>
        )}
      />
      {syncStateForDisplay === "stale" || syncStateForDisplay === "partially_synced" ? (
        <StaleState
          message={
            syncStateForDisplay === "partially_synced"
              ? "Profile snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes."
              : `Your GitRank profile was refreshed ${formatRelativeDays(data.refreshedAt)}.`
          }
          updatedAt={data.refreshedAt}
          onRefresh={async () => {
            try {
              const result = await runUserSync.mutateAsync();
              return buildUserSyncRefreshFeedback(result);
            } finally {
              await refetch();
            }
          }}
          isRefreshing={runUserSync.isPending}
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
        <StatCard
          className="xl:col-span-3"
          label="Merged PRs"
          value={user.mergedPrCount}
          detail="Merged work is the primary ranking evidence."
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
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
