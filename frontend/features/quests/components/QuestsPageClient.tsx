"use client";

import dynamic from "next/dynamic";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Flame,
  LayoutGrid,
  Route,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { startTransition, useDeferredValue, useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { GlowCard } from "@/components/shared/GlowCard";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { ControlSurface } from "@/components/shared/ControlSurface";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRunUserSync } from "@/hooks/use-account-actions";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import { useQuests } from "@/hooks/use-quests";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/lib/presentation/sync-run-diagnostics";
import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
import type { Quest } from "@/types/gitrank";

const groups: Array<Quest["cadence"]> = ["Daily", "Weekly", "Long-term", "Skill-based"];
const QUEST_GROUP_PAGE_SIZE_DEFAULT = 5;
const QUEST_GROUP_PAGE_SIZE_CONSTRAINED = 3;
const QUEST_FILTERS: Array<{ value: "All" | Quest["cadence"]; label: string }> = [
  { value: "All", label: "All" },
  { value: "Daily", label: "Daily" },
  { value: "Weekly", label: "Weekly" },
  { value: "Long-term", label: "Long-term" },
  { value: "Skill-based", label: "Skill-based" },
];
const QUESTS_SECTION_LINKS = [
  { id: "quests-filters", label: "Filters" },
  { id: "quests-journey", label: "Journey" },
  { id: "quests-spotlight", label: "Spotlight" },
  { id: "quests-missions", label: "Missions" },
];

const QuestCard = dynamic(
  () =>
    import("@/features/quests/components/QuestCard").then(
      (mod) => mod.QuestCard,
    ),
  {
    loading: () => <QuestPanelPlaceholder />,
  },
);

export function QuestsPageClient() {
  const questsMissionsRegionId = useId();
  const questsFilterStatusId = useId();
  const constrainedNetwork = useNetworkConstraintPreference();
  const runUserSync = useRunUserSync();
  const { data, isLoading, isError, refetch } = useQuests();
  const syncRunsQuery = useProfileSyncRuns();
  const questGroupPageSize = constrainedNetwork
    ? QUEST_GROUP_PAGE_SIZE_CONSTRAINED
    : QUEST_GROUP_PAGE_SIZE_DEFAULT;
  const [visibleGroupCounts, setVisibleGroupCounts] = useState<
    Record<Quest["cadence"], number>
  >(() => ({
    Daily: questGroupPageSize,
    Weekly: questGroupPageSize,
    "Long-term": questGroupPageSize,
    "Skill-based": questGroupPageSize,
  }));
  const [cadenceFilter, setCadenceFilter] = useState<"All" | Quest["cadence"]>("All");
  const deferredCadenceFilter = useDeferredValue(cadenceFilter);
  const quests = data?.quests ?? [];
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
  const staleSyncRefresh = useStaleSyncRefresh({
    runs: syncRunsQuery.data?.runs,
    isSyncPending: runUserSync.isPending,
    requestSync: () => runUserSync.mutateAsync(),
    refetchAfterSync: async () => {
      await refetch();
    },
  });
  const questSnapshotRefreshedAt =
    data?.staleness?.refreshedAt ?? profile?.refreshedAt ?? new Date().toISOString();
  const contributionRows = profile?.user.contributions ?? [];
  const streak = summarizeContributionStreak(contributionRows);
  const dayOfYear = dayOfYearUTC(new Date());
  const dayProgress = Math.round((dayOfYear / 365) * 100);
  const questMap = {
    Daily: quests.filter((quest) => quest.cadence === "Daily"),
    Weekly: quests.filter((quest) => quest.cadence === "Weekly"),
    "Long-term": quests.filter((quest) => quest.cadence === "Long-term"),
    "Skill-based": quests.filter((quest) => quest.cadence === "Skill-based"),
  } as const;
  const todayQuest = selectQuestSpotlight(
    questMap.Daily.length > 0 ? questMap.Daily : quests,
  );
  const weeklyQuest = selectQuestSpotlight(questMap.Weekly);
  const longTermQuest = selectQuestSpotlight(questMap["Long-term"]);
  const visibleGroups =
    deferredCadenceFilter === "All"
      ? groups.filter((group) => questMap[group].length > 0)
      : groups.filter((group) => group === deferredCadenceFilter && questMap[group].length > 0);
  const visibleQuestCount =
    deferredCadenceFilter === "All"
      ? quests.length
      : questMap[deferredCadenceFilter].length;
  const canResetCadenceFilter = cadenceFilter !== "All";
  const activeFilterCount = canResetCadenceFilter ? 1 : 0;
  const isFiltering = deferredCadenceFilter !== cadenceFilter;
  const staleNotice = useMemo(
    () =>
      buildStaleSyncNotice({
        syncState: displaySyncState === "partially_synced" ? "partially_synced" : "stale",
        refreshedAt: questSnapshotRefreshedAt,
        latestSyncOutcome,
        snapshotLabel: "Quest snapshot",
        partialFallback:
          "Quest snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
        staleFallback:
          "Live quest signals may lag until the next sync completes.",
      }),
    [displaySyncState, latestSyncOutcome, questSnapshotRefreshedAt],
  );

  function handleCadenceFilterChange(next: "All" | Quest["cadence"]) {
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
              showFreshness={shouldShowProfileFreshnessPill(showRefreshPill, displaySyncState, appInstallationBlocked)}
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
          <div className="space-y-3">
          <p id={questsFilterStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {isFiltering
              ? "Updating missions…"
              : deferredCadenceFilter === "All"
                ? `Showing all ${visibleQuestCount} missions`
                : `Showing ${visibleQuestCount} ${deferredCadenceFilter.toLowerCase()} missions`}
          </p>
          <ControlSurface>
            <FilterControlsHeader
              label="Mission controls"
              summary={
                isFiltering
                  ? "Updating missions..."
                  : deferredCadenceFilter === "All"
                    ? `${visibleQuestCount} missions`
                    : `${visibleQuestCount} ${deferredCadenceFilter.toLowerCase()} missions`
              }
              activeFilterCount={activeFilterCount}
              resetAction={{
                onReset: () => {
                  handleCadenceFilterChange("All");
                },
                enabled: canResetCadenceFilter,
                ariaControls: questsMissionsRegionId,
              }}
            />
            <div className="space-y-2">
              <p className="text-xs font-medium text-primary">Cadence lane</p>
              <SegmentedTablist
                options={QUEST_FILTERS.map((item) => {
                  const count =
                    item.value === "All"
                      ? quests.length
                      : questMap[item.value].length;
                  const Icon =
                    item.value === "All"
                      ? LayoutGrid
                      : item.value === "Daily"
                        ? CalendarClock
                        : item.value === "Weekly"
                          ? CalendarDays
                          : item.value === "Long-term"
                            ? Route
                            : Sparkles;
                  return {
                    value: item.value,
                    label: item.label,
                    compactLabel:
                      item.value === "Skill-based"
                        ? "Skills"
                        : item.value === "Long-term"
                          ? "Long"
                          : item.label,
                    icon: <Icon className="h-4 w-4" aria-hidden="true" />,
                    count,
                    minWidthClassName: "min-w-[6.75rem] sm:min-w-[8rem]",
                  };
                })}
                value={cadenceFilter}
                onValueChange={handleCadenceFilterChange}
                ariaLabel="Mission cadence filters"
                ariaDescribedBy={questsFilterStatusId}
                ariaControls={questsMissionsRegionId}
                tabIdPrefix="quest-filter-tab"
                wrap
              />
            </div>
          </ControlSurface>
          </div>
        ) : null}
      </section>
      {displaySyncState === "stale" || displaySyncState === "partially_synced" ? (
        <StaleState
          message={staleNotice.message}
          reasonMessage={staleNotice.reasonMessage}
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
                    <h2 className="mt-3 text-2xl font-semibold text-white">Day {dayOfYear} of 365</h2>
                    <p className="mt-2 text-sm text-muted">
                      Keep contribution momentum steady.
                    </p>
                  </div>
                  <div className="grid gap-2 rounded-2xl border border-fuchsia-300/28 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100">
                    <span className="inline-flex items-center gap-2"><Flame className="h-4 w-4" aria-hidden="true" /> Current streak: <span className="numeric-readout">{streak.currentStreakDays.toLocaleString("en-US")}d</span></span>
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Best streak: <span className="numeric-readout">{streak.bestStreakDays.toLocaleString("en-US")}d</span></span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Annual progression</span>
                    <span className="numeric-readout">{dayProgress}%</span>
                  </div>
                  <Progress value={dayProgress} />
                </div>
              </div>
            </GlowCard>
          ) : null}
        </section>
        <section id="quests-spotlight" data-scroll-target="true" className="render-opt-section">
          {!isLoading && !isError ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Mission spotlight</h2>
              <ul role="list" className="grid gap-3 md:grid-cols-3">
                <MissionSpotlightCard
                  kind="daily"
                  title="Today's Quest"
                  quest={todayQuest}
                  emptyCopy="No daily mission yet."
                  href="/dashboard/contributions"
                  cta="Open contributions"
                />
                <MissionSpotlightCard
                  kind="weekly"
                  title="Weekly Challenge"
                  quest={weeklyQuest}
                  emptyCopy="No weekly challenge yet."
                  href="/dashboard/settings"
                  cta="Open sync settings"
                />
                <MissionSpotlightCard
                  kind="long-term"
                  title="Long-Term Journey"
                  quest={longTermQuest}
                  emptyCopy="No long-term objective yet."
                  href="/dashboard/contributions"
                  cta="Keep building"
                />
              </ul>
            </div>
          ) : null}
        </section>
        <section id="quests-missions" data-scroll-target="true" className="render-opt-section space-y-4">
          {isLoading ? <LoadingState message="Loading quests..." /> : null}
          {isError ? (
            <ErrorState
              title="Quest engine unavailable"
              description="Quest recommendations are unavailable right now. Retry or open sync settings."
              onRetry={() => {
                void refetch();
              }}
              fallbackLabel="Open sync settings"
              fallbackHref="/dashboard/settings"
              analyticsTarget="quests:error"
            />
          ) : null}
          {!isLoading && !isError && quests.length === 0 ? (
            <EmptyState
              eyebrow="Quest generation"
              title="No quests ready yet."
              description="Sync and complete scored contributions to unlock quests."
              actionLabel="Open sync settings"
              actionHref="/dashboard/settings"
              analyticsTarget="quests:empty"
            />
          ) : null}
          {!isLoading && !isError && data ? (
            visibleGroups.map((group) => {
              const grouped = questMap[group];
              const visibleCount = visibleGroupCounts[group] ?? questGroupPageSize;
              const visibleGroup = grouped.slice(0, visibleCount);
              const hasMoreInGroup = grouped.length > visibleGroup.length;
              const remainingInGroup = Math.max(0, grouped.length - visibleGroup.length);

              return (
                <section
                  key={group}
                  className="space-y-4"
                >
                  <h3 className="text-sm font-semibold text-white">
                    {labelForGroup(group)} ({grouped.length})
                  </h3>
                  <div>
                    <ul role="list" className="grid gap-4 xl:grid-cols-2">
                      {visibleGroup.map((quest, index) => (
                        <li key={`${quest.id}-${index}`} className="list-none">
                          <QuestCard quest={quest} />
                        </li>
                      ))}
                    </ul>
                    {hasMoreInGroup ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted">{remainingInGroup} missions remaining</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            startTransition(() => {
                              setVisibleGroupCounts((current) => ({
                                ...current,
                                [group]: Math.min(grouped.length, (current[group] ?? questGroupPageSize) + questGroupPageSize),
                              }));
                            });
                          }}
                        >
                          Show more missions
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })
          ) : null}
        </section>
      </div>
    </div>
  );
}

function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

function labelForGroup(group: Quest["cadence"]): string {
  if (group === "Daily") return "Today's Quest";
  if (group === "Weekly") return "Weekly Challenge";
  if (group === "Long-term") return "Long-Term Contributor Journey";
  return "Skill-based Missions";
}

function recoveryHrefForGroup(group: Quest["cadence"]): string {
  if (group === "Long-term") {
    return "/dashboard/settings";
  }
  return "/dashboard/contributions";
}

function recoveryLabelForGroup(group: Quest["cadence"]): string {
  if (group === "Long-term") {
    return "Refresh sync settings";
  }
  if (group === "Skill-based") {
    return "Inspect contribution skills";
  }
  return "Open contributions";
}

function selectQuestSpotlight(source: Quest[]): Quest | null {
  if (!source.length) {
    return null;
  }
  const ranked = [...source].sort((left, right) => {
    const leftRank = questStatusRank(left.status);
    const rightRank = questStatusRank(right.status);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftProgress = safeQuestProgress(left);
    const rightProgress = safeQuestProgress(right);
    if (leftProgress !== rightProgress) {
      return rightProgress - leftProgress;
    }
    if (left.rewardXp !== right.rewardXp) {
      return right.rewardXp - left.rewardXp;
    }
    return left.title.localeCompare(right.title);
  });
  return ranked[0] ?? null;
}

function questStatusRank(status: Quest["status"]): number {
  if (status === "Active") {
    return 0;
  }
  if (status === "Locked") {
    return 1;
  }
  return 2;
}

function safeQuestProgress(quest: Quest): number {
  const goal = quest.goal > 0 ? quest.goal : 1;
  const ratio = (quest.progress / goal) * 100;
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(ratio)));
}

function MissionSpotlightCard({
  kind,
  title,
  quest,
  emptyCopy,
  href,
  cta,
}: {
  kind: "daily" | "weekly" | "long-term";
  title: string;
  quest: Quest | null;
  emptyCopy: string;
  href: string;
  cta: string;
}) {
  const iconTone =
    kind === "daily"
      ? "text-cyan-200"
      : kind === "weekly"
        ? "text-violet-200"
        : "text-emerald-200";
  const Icon =
    kind === "daily"
      ? CalendarClock
      : kind === "weekly"
        ? CalendarDays
        : Route;
  if (!quest) {
    return (
      <li className="list-none">
        <div className="neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4">
          <p className={`inline-flex items-center gap-2 text-xs font-medium ${iconTone}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {title}
          </p>
          <p className="text-sm text-muted">{emptyCopy}</p>
          <Button asChild variant="secondary" size="sm">
            <IntentPrefetchLink href={href}>
              {cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </IntentPrefetchLink>
          </Button>
        </div>
      </li>
    );
  }

  const progress = safeQuestProgress(quest);
  const statusMeta = questStatusMeta(quest.status);

  return (
    <li className="list-none">
      <div className="neon-surface space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`inline-flex items-center gap-2 text-xs font-medium ${iconTone}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {title}
            </p>
            <p className="mt-2 text-base font-semibold text-white">{quest.title}</p>
            <span className={statusMeta.className}>
              {statusMeta.label}
            </span>
          </div>
          <span className="neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold">
            <span className="numeric-readout">+{quest.rewardXp.toLocaleString("en-US")} XP</span>
          </span>
        </div>
        <p className="text-sm text-muted">{quest.description}</p>
        <div className="space-y-1">
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="numeric-readout">{quest.progress.toLocaleString("en-US")} / {quest.goal.toLocaleString("en-US")}</span>
            <span className="numeric-readout">{progress}%</span>
          </div>
        </div>
        <p className="text-xs text-cyan-100">
          Next move: {recoveryLabelForGroup(quest.cadence)}
        </p>
        <Button asChild variant="secondary" size="sm">
          <IntentPrefetchLink href={recoveryHrefForGroup(quest.cadence)}>
            {recoveryLabelForGroup(quest.cadence)}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </IntentPrefetchLink>
        </Button>
      </div>
    </li>
  );
}

function questStatusMeta(status: Quest["status"]): { label: string; className: string } {
  if (status === "Completed") {
    return {
      label: "Completed",
      className: "mt-2 inline-flex neon-chip neon-chip-success rounded-full px-2.5 py-1 text-xs font-semibold",
    };
  }
  if (status === "Locked") {
    return {
      label: "Locked",
      className: "mt-2 inline-flex neon-chip neon-chip-warning rounded-full px-2.5 py-1 text-xs font-semibold",
    };
  }
  return {
    label: "Active",
    className: "mt-2 inline-flex neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold",
  };
}

function QuestPanelPlaceholder() {
  return (
    <GlowCard className="min-h-[15rem] space-y-3">
      <p className="text-xs font-medium text-primary">Loading quest card</p>
      <div className="neon-skeleton h-9 w-2/5" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
