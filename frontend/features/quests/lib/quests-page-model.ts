import { selectQuestSpotlight } from "@/features/quests/lib/quest-spotlight";
import { toRatioPercent } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import {
  buildStaleSyncNotice,
  type StaleSyncNotice,
} from "@/lib/presentation/stale-sync-notice";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";
import type { ProfileViewData, Quest, SyncState } from "@/types/gitrank";

const QUEST_GROUP_PAGE_SIZE_DEFAULT = 5;
const QUEST_GROUP_PAGE_SIZE_CONSTRAINED = 3;

export const QUEST_CADENCE_GROUPS: Array<Quest["cadence"]> = [
  "Daily",
  "Weekly",
  "Long-term",
  "Skill-based",
];

export type QuestCadenceFilter = "All" | Quest["cadence"];
export type QuestCadenceCounts = Record<Quest["cadence"], number>;
export type QuestGroupMap = Record<Quest["cadence"], Quest[]>;

export type QuestsPageModelInput = {
  quests: Quest[];
  profile?: ProfileViewData;
  cadenceFilter: QuestCadenceFilter;
  deferredCadenceFilter: QuestCadenceFilter;
  visibleGroupCounts: Record<Quest["cadence"], number>;
  constrainedNetwork: boolean;
  displaySyncState?: SyncState;
  latestSyncOutcome?: SyncRunDiagnostic | null;
  questSnapshotRefreshedAt?: string;
  now?: Date;
};

export function resolveQuestGroupPageSize(constrainedNetwork: boolean): number {
  return constrainedNetwork
    ? QUEST_GROUP_PAGE_SIZE_CONSTRAINED
    : QUEST_GROUP_PAGE_SIZE_DEFAULT;
}

export function buildInitialVisibleQuestGroupCounts(
  questGroupPageSize: number,
): Record<Quest["cadence"], number> {
  return {
    Daily: questGroupPageSize,
    Weekly: questGroupPageSize,
    "Long-term": questGroupPageSize,
    "Skill-based": questGroupPageSize,
  };
}

export function buildQuestsPageModel({
  quests,
  profile,
  cadenceFilter,
  deferredCadenceFilter,
  visibleGroupCounts,
  constrainedNetwork,
  displaySyncState = "synced",
  latestSyncOutcome = null,
  questSnapshotRefreshedAt,
  now = new Date(),
}: QuestsPageModelInput) {
  const questGroupPageSize = resolveQuestGroupPageSize(constrainedNetwork);
  const questMap = buildQuestGroupMap(quests);
  const questCadenceCounts = buildQuestCadenceCounts(questMap);
  const visibleGroups =
    deferredCadenceFilter === "All"
      ? QUEST_CADENCE_GROUPS.filter((group) => questMap[group].length > 0)
      : QUEST_CADENCE_GROUPS.filter(
          (group) => group === deferredCadenceFilter && questMap[group].length > 0,
        );
  const canResetCadenceFilter = cadenceFilter !== "All";
  const isFiltering = deferredCadenceFilter !== cadenceFilter;
  const contributionRows = profile?.user.contributions ?? [];
  const streak = summarizeContributionStreak(contributionRows);
  const dayOfYear = dayOfYearUTC(now);
  const dayProgress = toRatioPercent(dayOfYear / 365);
  const todayQuest = selectQuestSpotlight(
    questMap.Daily.length > 0 ? questMap.Daily : quests,
  );
  const weeklyQuest = selectQuestSpotlight(questMap.Weekly);
  const longTermQuest = selectQuestSpotlight(questMap["Long-term"]);
  const shouldShowStaleState =
    displaySyncState === "stale" || displaySyncState === "partially_synced";
  const staleNotice = buildQuestsStaleNotice({
    displaySyncState,
    refreshedAt: questSnapshotRefreshedAt ?? profile?.refreshedAt,
    latestSyncOutcome,
  });

  return {
    questGroupPageSize,
    visibleGroupCounts,
    questMap,
    questCadenceCounts,
    visibleGroups,
    canResetCadenceFilter,
    isFiltering,
    streak,
    dayOfYear,
    dayProgress,
    todayQuest,
    weeklyQuest,
    longTermQuest,
    shouldShowStaleState,
    staleNotice,
  };
}

export function buildQuestGroupMap(quests: Quest[]): QuestGroupMap {
  return {
    Daily: quests.filter((quest) => quest.cadence === "Daily"),
    Weekly: quests.filter((quest) => quest.cadence === "Weekly"),
    "Long-term": quests.filter((quest) => quest.cadence === "Long-term"),
    "Skill-based": quests.filter((quest) => quest.cadence === "Skill-based"),
  };
}

export function buildQuestCadenceCounts(questMap: QuestGroupMap): QuestCadenceCounts {
  return {
    Daily: questMap.Daily.length,
    Weekly: questMap.Weekly.length,
    "Long-term": questMap["Long-term"].length,
    "Skill-based": questMap["Skill-based"].length,
  };
}

export function buildQuestsStaleNotice({
  displaySyncState,
  refreshedAt,
  latestSyncOutcome,
}: {
  displaySyncState: SyncState;
  refreshedAt?: string;
  latestSyncOutcome: SyncRunDiagnostic | null;
}): StaleSyncNotice {
  return buildStaleSyncNotice({
    syncState: displaySyncState === "partially_synced" ? "partially_synced" : "stale",
    refreshedAt,
    latestSyncOutcome,
    snapshotLabel: "Quest snapshot",
    partialFallback:
      "Quest snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
    staleFallback:
      "Live quest signals may lag until the next sync completes.",
  });
}

export function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}
