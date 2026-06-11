"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef } from "react";
import { Activity, Flame, Medal } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { buildDashboardPageModel } from "@/features/dashboard/lib/dashboard-page-model";
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
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { formatPluralCount } from "@/lib/formatters";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
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

const DASHBOARD_SECTION_LINKS = [
  { id: "dashboard-identity", label: "Identity" },
  { id: "dashboard-signals", label: "Signals" },
  { id: "dashboard-progression", label: "Progression" },
  { id: "dashboard-reports", label: "Reports" },
];

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
    requestSync: () => runUserSync.mutateAsync(undefined),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const dashboardPage = useMemo(
    () =>
      buildDashboardPageModel({
        user,
        isStale: data?.isStale,
        trendWindowLabel: data?.trendWindowLabel,
        refreshedAt: data?.refreshedAt,
        displaySyncState,
        latestSyncOutcome,
        constrainedNetwork,
      }),
    [
      constrainedNetwork,
      data?.isStale,
      data?.refreshedAt,
      data?.trendWindowLabel,
      displaySyncState,
      latestSyncOutcome,
      user,
    ],
  );
  const abraInsights = useAbraInsights(dashboardPage.abraPayload);

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
    return (
      <RouteLoadingState
        eyebrow="Dashboard"
        title="Dashboard"
        description="Loading rank, contribution signals, and recent reports."
        cardCount={4}
        variant="dashboard"
      />
    );
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
        description="Identity, rank progress, and recent reports."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Rank ${user.level.rankTier}` },
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
              showFreshness={shouldShowProfileFreshnessPill(
                showRefreshPill,
                displaySyncState,
                appInstallationBlocked,
              )}
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
      {dashboardPage.staleNotice ? (
        <StaleState
          message={dashboardPage.staleNotice.message}
          reasonMessage={dashboardPage.staleNotice.reasonMessage}
          updatedAt={data.refreshedAt}
          syncState={displaySyncState === "partially_synced" ? "partially_synced" : "stale"}
          onRefresh={staleSyncRefresh.onRefresh}
          isRefreshing={staleSyncRefresh.isRefreshing}
          refreshLabel={staleSyncRefresh.refreshLabel}
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="dashboard:stale"
        />
      ) : null}
      <InPageSectionNav sections={DASHBOARD_SECTION_LINKS} className="render-opt-section" />
      <section id="dashboard-identity" data-scroll-target="true">
        <DashboardHeroRankCard
          user={user}
          archetype={abraInsights.data?.archetype ?? dashboardPage.fallbackArchetype}
          identitySummary={
            abraInsights.data?.identitySummary ?? dashboardPage.fallbackIdentitySummary
          }
          aiMode={abraInsights.data?.generatedBy ?? "deterministic"}
          effectiveSyncState={displaySyncState}
        />
      </section>
      <section
        id="dashboard-signals"
        data-scroll-target="true"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12"
      >
        <StatCard
          className="xl:col-span-6"
          valueClassName="text-4xl"
          label="GitRank score"
          value={user.gitRankScore}
          detail="Impact-weighted from merged PR evidence."
          icon={<Medal className="h-5 w-5 text-primary" aria-hidden="true" />}
        />
        <GlowCard className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm">Current streak</span>
            <span className="hud-pill rounded-[var(--radius-universal)] p-2">
              <Flame className="h-5 w-5 text-primary" aria-hidden="true" />
            </span>
          </div>
          <div className="numeric-readout text-3xl font-semibold tracking-tight">
            {formatPluralCount(dashboardPage.streak.currentStreakDays, "day")}
          </div>
          <p className="text-sm leading-6 text-muted">
            Best {formatPluralCount(dashboardPage.streak.bestStreakDays, "day")} •{" "}
            {formatPluralCount(dashboardPage.streak.activeDaysThisYear, "active day")} this year
          </p>
        </GlowCard>
        <StatCard
          className="xl:col-span-3"
          label="Merged PRs"
          value={user.mergedPrCount}
          detail="Primary input for rank progression."
          icon={<Activity className="h-5 w-5 text-primary" aria-hidden="true" />}
        />
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.86fr,1.14fr]">
        <div className="space-y-6">
          <section
            id="dashboard-progression"
            data-scroll-target="true"
            className="render-opt-section"
          >
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
          <section
            id="dashboard-reports"
            data-scroll-target="true"
            className="render-opt-section"
          >
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
    <PanelLoadingPlaceholder label={label} />
  );
}
