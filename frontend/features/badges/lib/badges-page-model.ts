import { deriveDeterministicArchetype } from "@/lib/ai/deterministic-identity-summary";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import {
  buildStaleSyncNotice,
  type StaleSyncNotice,
} from "@/lib/presentation/stale-sync-notice";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";
import type { Badge, ProfileViewData, SyncState } from "@/types/gitrank";
import {
  buildBadgeFilterState,
  buildBadgeShelfModel,
  type BadgeRarityFilter,
  type BadgeVisibilityFilter,
} from "@/features/badges/lib/badge-shelf-model";
import { formatPluralCount } from "@/lib/formatters";

const LOCKED_BADGE_PAGE_SIZE_DEFAULT = 8;
const LOCKED_BADGE_PAGE_SIZE_CONSTRAINED = 4;
const BADGE_SHELF_PAGE_SIZE_DEFAULT = 10;
const BADGE_SHELF_PAGE_SIZE_CONSTRAINED = 6;

export type BadgePageSizes = {
  lockedBadgePageSize: number;
  badgeShelfPageSize: number;
};

export type BadgesPageModelInput = {
  badges: Badge[];
  profile?: ProfileViewData;
  rarity: BadgeRarityFilter;
  visibility: BadgeVisibilityFilter;
  deferredRarity: BadgeRarityFilter;
  deferredVisibility: BadgeVisibilityFilter;
  visibleBadgeCount: number;
  visibleLockedCount: number;
  constrainedNetwork: boolean;
  displaySyncState?: SyncState;
  latestSyncOutcome?: SyncRunDiagnostic | null;
};

export function resolveBadgePageSizes(constrainedNetwork: boolean): BadgePageSizes {
  return constrainedNetwork
    ? {
        lockedBadgePageSize: LOCKED_BADGE_PAGE_SIZE_CONSTRAINED,
        badgeShelfPageSize: BADGE_SHELF_PAGE_SIZE_CONSTRAINED,
      }
    : {
        lockedBadgePageSize: LOCKED_BADGE_PAGE_SIZE_DEFAULT,
        badgeShelfPageSize: BADGE_SHELF_PAGE_SIZE_DEFAULT,
      };
}

export function buildBadgesPageModel({
  badges,
  profile,
  rarity,
  visibility,
  deferredRarity,
  deferredVisibility,
  visibleBadgeCount,
  visibleLockedCount,
  constrainedNetwork,
  displaySyncState = "synced",
  latestSyncOutcome = null,
}: BadgesPageModelInput) {
  const pageSizes = resolveBadgePageSizes(constrainedNetwork);
  const isFiltering = deferredRarity !== rarity || deferredVisibility !== visibility;
  const filterState = buildBadgeFilterState({ rarity, visibility });
  const badgeShelf = buildBadgeShelfModel({
    badges,
    rarity: deferredRarity,
    visibility: deferredVisibility,
    visibleBadgeCount,
    visibleLockedCount,
  });
  const streak = summarizeContributionStreak(profile?.user.contributions ?? []);
  const abraPayload = buildAbraInsightsRequest({
    user: profile?.user,
    contributions: profile?.user.contributions ?? [],
    badges: badgeShelf.filtered,
    repositoriesTouched: profile?.topRepositories.length ?? 0,
    streakDays: streak.currentStreakDays,
    enabled: !constrainedNetwork,
    badgeLimit: 10,
    badgeCount: badgeShelf.unlockedCount,
  });
  const fallbackArchetype = profile
    ? deriveDeterministicArchetype(profile.user.strongestSignals)
    : "Systems Builder";
  const shouldShowStaleState =
    Boolean(profile) && (displaySyncState === "stale" || displaySyncState === "partially_synced");
  const staleNotice = buildBadgesStaleNotice({
    displaySyncState,
    refreshedAt: profile?.refreshedAt,
    latestSyncOutcome,
  });

  return {
    pageSizes,
    isFiltering,
    filterState,
    badgeShelf,
    streak,
    abraPayload,
    fallbackArchetype,
    shouldShowStaleState,
    staleNotice,
  };
}

export function buildBadgesStaleNotice({
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
    snapshotLabel: "Badge snapshot",
    partialFallback:
      "Badge snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
    staleFallback:
      "New unlocks can appear after the next completed sync.",
  });
}

export function buildBadgeUnlockNotice(delta: number) {
  const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.round(delta)) : 0;
  if (safeDelta === 0) {
    return "";
  }
  const headline = safeDelta === 1 ? "Badge unlocked." : "Badges unlocked.";
  return `${headline} Your shelf gained ${formatPluralCount(safeDelta, "new achievement")}.`;
}
