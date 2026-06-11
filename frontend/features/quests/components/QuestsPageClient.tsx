"use client";

import {
  CalendarClock,
  Flame,
  ShieldCheck,
} from "lucide-react";
import { startTransition, useDeferredValue, useId, useMemo, useState } from "react";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { GlowCard } from "@/components/shared/GlowCard";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import { useQuests } from "@/hooks/use-quests";
import { QuestsCadenceControls } from "@/features/quests/components/QuestsCadenceControls";
import { QuestsMissionsSection } from "@/features/quests/components/QuestsMissionsSection";
import { QuestsSpotlightSection } from "@/features/quests/components/QuestsSpotlightSection";
import {
  buildInitialVisibleQuestGroupCounts,
  buildQuestsPageModel,
  resolveQuestGroupPageSize,
  type QuestCadenceFilter,
} from "@/features/quests/lib/quests-page-model";
import { formatPluralCount } from "@/lib/formatters";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
import type { Quest } from "@/types/gitrank";

const QUESTS_SECTION_LINKS = [
  { id: "quests-filters", label: "Filters" },
  { id: "quests-journey", label: "Journey" },
  { id: "quests-spotlight", label: "Spotlight" },
  { id: "quests-missions", label: "Missions" },
];
const EMPTY_QUESTS: Quest[] = [];

export function QuestsPageClient() {
  const questsMissionsRegionId = useId();
  const questsFilterStatusId = useId();
  const constrainedNetwork = useNetworkConstraintPreference();
  const runUserSync = useRunUserSync();
  const { data, isLoading, isError, refetch } = useQuests();
  const syncRunsQuery = useProfileSyncRuns();
  const questGroupPageSize = resolveQuestGroupPageSize(constrainedNetwork);
  const [visibleGroupCounts, setVisibleGroupCounts] = useState<
    Record<Quest["cadence"], number>
  >(() => buildInitialVisibleQuestGroupCounts(questGroupPageSize));
  const [cadenceFilter, setCadenceFilter] = useState<QuestCadenceFilter>("All");
  const deferredCadenceFilter = useDeferredValue(cadenceFilter);
  const quests = data?.quests ?? EMPTY_QUESTS;
  const profile = data?.profile;
  const { syncStateForDisplay, showRefreshPill } = useProfileSyncState(
    profile?.user,
    syncRunsQuery.data?.runs,
  );
  const latestSyncOutcome = useMemo(
    () => selectLatestActionableSyncRunOutcome(syncRunsQuery.data?.runs),
    [syncRunsQuery.data?.runs],
  );
  const appInstallationBlocked = isGitHubAppInstallationBlocked(latestSyncOutcome);
  const displaySyncState = appInstallationBlocked ? "failed" : syncStateForDisplay;
  const questSnapshotRefreshedAt =
    data?.staleness?.refreshedAt ?? profile?.refreshedAt;
  const questPage = useMemo(
    () =>
      buildQuestsPageModel({
        quests,
        profile,
        cadenceFilter,
        deferredCadenceFilter,
        visibleGroupCounts,
        constrainedNetwork,
        displaySyncState,
        latestSyncOutcome,
        questSnapshotRefreshedAt,
      }),
    [
      cadenceFilter,
      constrainedNetwork,
      deferredCadenceFilter,
      displaySyncState,
      latestSyncOutcome,
      profile,
      questSnapshotRefreshedAt,
      quests,
      visibleGroupCounts,
    ],
  );
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(undefined),
    refetchAfterSync: async () => {
      await refetch();
    },
  });

  function handleCadenceFilterChange(next: QuestCadenceFilter) {
    startTransition(() => {
      setCadenceFilter(next);
    });
  }

  return (
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Quests"
        title="Quests"
        description="Daily, weekly, and long-term quest lanes."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `Focus ${deferredCadenceFilter}` },
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
              refreshedAt={questSnapshotRefreshedAt}
              syncState={displaySyncState}
            />
            <Button asChild variant="secondary" size="sm">
              <IntentPrefetchLink href="/dashboard/contributions">
                Contributions
              </IntentPrefetchLink>
            </Button>
          </div>
        )}
      />
      {appInstallationBlocked ? (
        <GitHubAppSyncBlockNotice message={latestSyncOutcome?.message} />
      ) : null}
      <InPageSectionNav sections={QUESTS_SECTION_LINKS} className="render-opt-section" />
      <section id="quests-filters" data-scroll-target="true" className="render-opt-section">
        {!isLoading && !isError ? (
          <QuestsCadenceControls
            totalQuestCount={quests.length}
            cadenceCounts={questPage.questCadenceCounts}
            value={cadenceFilter}
            displayValue={deferredCadenceFilter}
            isFiltering={questPage.isFiltering}
            canReset={questPage.canResetCadenceFilter}
            filterStatusId={questsFilterStatusId}
            missionsRegionId={questsMissionsRegionId}
            onValueChange={handleCadenceFilterChange}
          />
        ) : null}
      </section>
      {questPage.shouldShowStaleState ? (
        <StaleState
          message={questPage.staleNotice.message}
          reasonMessage={questPage.staleNotice.reasonMessage}
          updatedAt={questSnapshotRefreshedAt}
          syncState={displaySyncState === "partially_synced" ? "partially_synced" : "stale"}
          onRefresh={staleSyncRefresh.onRefresh}
          isRefreshing={staleSyncRefresh.isRefreshing}
          refreshLabel={staleSyncRefresh.refreshLabel}
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="quests:stale"
        />
      ) : null}
      <div id={questsMissionsRegionId} className="space-y-6">
        <section id="quests-journey" data-scroll-target="true" className="render-opt-section">
          {!isLoading && !isError && profile ? (
            <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-cyan-100">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      365-day contributor journey
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">Day {questPage.dayOfYear} of 365</h2>
                    <p className="mt-2 text-sm text-muted">
                      Keep contribution momentum steady.
                    </p>
                  </div>
                  <div className="grid gap-2 rounded-[var(--radius-universal)] border border-fuchsia-300/28 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100">
                    <span className="inline-flex items-center gap-2"><Flame className="h-4 w-4" aria-hidden="true" /> Current streak: <span className="numeric-readout">{formatPluralCount(questPage.streak.currentStreakDays, "day")}</span></span>
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Best streak: <span className="numeric-readout">{formatPluralCount(questPage.streak.bestStreakDays, "day")}</span></span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Annual progression</span>
                    <span className="numeric-readout">{questPage.dayProgress}%</span>
                  </div>
                  <Progress value={questPage.dayProgress} aria-label="Annual quest progression" />
                </div>
              </div>
            </GlowCard>
          ) : null}
        </section>
        <QuestsSpotlightSection
          dailyQuest={questPage.todayQuest}
          weeklyQuest={questPage.weeklyQuest}
          longTermQuest={questPage.longTermQuest}
          isLoading={isLoading}
          isError={isError}
        />
        <QuestsMissionsSection
          quests={quests}
          visibleGroups={questPage.visibleGroups}
          questMap={questPage.questMap}
          visibleGroupCounts={questPage.visibleGroupCounts}
          questGroupPageSize={questPage.questGroupPageSize}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => {
            void refetch();
          }}
          onShowMoreGroup={(group, totalCount) => {
            startTransition(() => {
              setVisibleGroupCounts((current) => ({
                ...current,
                [group]: Math.min(
                  totalCount,
                  (current[group] ?? questPage.questGroupPageSize) + questPage.questGroupPageSize,
                ),
              }));
            });
          }}
        />
      </div>
    </div>
  );
}
