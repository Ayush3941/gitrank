"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { Activity, Flame, Medal } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { buildDashboardStaleNotice } from "@/features/dashboard/lib/stale-notice";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useDashboard } from "@/hooks/use-dashboard";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import { ErrorState } from "@/components/shared/ErrorState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
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
  const syncRunsQuery = useProfileSyncRuns();
  const scoreExplanationEventSent = useRef(false);
  const user = data?.user;
  const recentReports = data?.recentReports ?? [];
  const { syncStateForDisplay, showRefreshPill } = useProfileSyncState(
    user,
    syncRunsQuery.data?.runs,
  );
  const latestSyncOutcome = useMemo(() => {
    return selectLatestActionableSyncRunOutcome(syncRunsQuery.data?.runs);
  }, [syncRunsQuery.data?.runs]);
  const appInstallationBlocked = isGitHubAppInstallationBlocked(latestSyncOutcome);
  const displaySyncState = appInstallationBlocked ? "failed" : syncStateForDisplay;
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const streak = useMemo(
    () => summarizeContributionStreak(user?.contributions ?? []),
    [user?.contributions],
  );
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

  const staleNotice =
    displaySyncState === "stale" || displaySyncState === "partially_synced"
      ? buildDashboardStaleNotice(displaySyncState, data.refreshedAt, latestSyncOutcome)
      : null;

  return (
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Dashboard"
        description="Identity, rank progress, and recent reports."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Rank ${user.level.rankTier}` },
              { label: `Merged PRs ${user.mergedPrCount.toLocaleString("en-US")}` },
              { label: `Streak ${streak.currentStreakDays}d` },
              {
                label: `Sync ${formatSyncStateLabel(displaySyncState)}`,
                tone: toneForSyncState(displaySyncState),
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ProfileEvidenceStateChip
              showFreshness={showRefreshPill}
              refreshedAt={data.refreshedAt}
              syncState={displaySyncState}
            />
            <Button asChild variant="secondary" size="sm">
              <IntentPrefetchLink href="/dashboard/contributions">
                View PR cards
              </IntentPrefetchLink>
            </Button>
          </div>
        )}
      />
      {appInstallationBlocked ? (
        <GitHubAppSyncBlockNotice message={latestSyncOutcome?.message} />
      ) : null}
      {staleNotice ? (
        <StaleState
          message={staleNotice.message}
          reasonMessage={staleNotice.reasonMessage}
          updatedAt={data.refreshedAt}
          onRefresh={staleSyncRefresh.onRefresh}
          isRefreshing={staleSyncRefresh.isRefreshing}
          refreshLabel={staleSyncRefresh.refreshLabel}
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
          effectiveSyncState={displaySyncState}
        />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <StatCard
          className="xl:col-span-6"
          valueClassName="text-4xl"
          label="GitRank score"
          value={user.gitRankScore}
          detail="Impact-weighted from merged PR evidence."
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
          detail="Primary input for rank progression."
          icon={<Activity className="h-5 w-5 text-primary" />}
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.86fr,1.14fr]">
        <div className="space-y-6">
          <section className="render-opt-section">
            <DeferUntilVisible fallback={<LazyLanePlaceholder label="Loading league" />}>
              <CurrentLeagueCard user={user} />
            </DeferUntilVisible>
          </section>
          <section className="render-opt-section">
            <DeferUntilVisible fallback={<LazyLanePlaceholder label="Loading quests" />}>
              <QuestPanel quests={user.quests} />
            </DeferUntilVisible>
          </section>
        </div>
        <div className="space-y-6">
          <section className="render-opt-section">
            <DeferUntilVisible fallback={<LazyLanePlaceholder label="Loading reports" />}>
              <RecentBattleReports reports={recentReports} />
            </DeferUntilVisible>
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
