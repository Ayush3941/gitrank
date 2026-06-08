import { deriveDeterministicArchetype } from "@/lib/ai/deterministic-identity-summary";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { Badge, ProfileViewData } from "@/types/gitrank";
import {
  buildBadgeFilterState,
  buildBadgeShelfModel,
  type BadgeRarityFilter,
  type BadgeVisibilityFilter,
} from "@/features/badges/lib/badge-shelf-model";

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

  return {
    pageSizes,
    isFiltering,
    filterState,
    badgeShelf,
    streak,
    abraPayload,
    fallbackArchetype,
  };
}
