import { toRatioPercent } from "@/lib/formatters";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import type { Badge, BadgeRarity } from "@/types/gitrank";

export type BadgeRarityFilter = BadgeRarity | "All";
export type BadgeVisibilityFilter = "All" | "Unlocked" | "Locked";

export function buildBadgeFilterState({
  rarity,
  visibility,
}: {
  rarity: BadgeRarityFilter;
  visibility: BadgeVisibilityFilter;
}) {
  return {
    canResetFilters: rarity !== "All" || visibility !== "All",
    activeFilterCount:
      (rarity !== "All" ? 1 : 0) + (visibility !== "All" ? 1 : 0),
  };
}

export function buildBadgeShelfModel({
  badges,
  rarity,
  visibility,
  visibleBadgeCount,
  visibleLockedCount,
}: {
  badges: Badge[];
  rarity: BadgeRarityFilter;
  visibility: BadgeVisibilityFilter;
  visibleBadgeCount: number;
  visibleLockedCount: number;
}) {
  const allBadges = deduplicateBadgesByName(badges);
  const filtered = allBadges.filter((badge) => badgeMatchesFilters(badge, rarity, visibility));
  const lockedBadges = allBadges.filter((badge) => !badge.unlocked);
  const lockedBadgesSorted = sortLockedBadges(lockedBadges);
  const unlockedCount = allBadges.filter((badge) => badge.unlocked).length;
  const totalCount = allBadges.length;
  const visibleLockedBadges = lockedBadgesSorted.slice(0, visibleLockedCount);
  const lockedBadgePreview = lockedBadgesSorted.slice(0, 3);
  const visibleBadges = filtered.slice(0, visibleBadgeCount);

  return {
    allBadges,
    filtered,
    lockedBadges,
    lockedBadgesSorted,
    unlockedCount,
    totalCount,
    visibleBadges,
    hasMoreBadges: filtered.length > visibleBadges.length,
    remainingBadges: Math.max(0, filtered.length - visibleBadges.length),
    visibleLockedBadges,
    lockedBadgePreview,
    hasMoreLockedBadges: lockedBadgesSorted.length > visibleLockedBadges.length,
    remainingLockedBadges: Math.max(0, lockedBadgesSorted.length - visibleLockedBadges.length),
    completionPercent: toRatioPercent(unlockedCount / totalCount),
    nextUnlockTarget: lockedBadgesSorted[0] ?? null,
  };
}

function badgeMatchesFilters(
  badge: Badge,
  rarity: BadgeRarityFilter,
  visibility: BadgeVisibilityFilter,
): boolean {
  const rarityMatch = rarity === "All" || badge.rarity === rarity;
  const visibilityMatch =
    visibility === "All" ||
    (visibility === "Unlocked" && badge.unlocked) ||
    (visibility === "Locked" && !badge.unlocked);
  return rarityMatch && visibilityMatch;
}

function sortLockedBadges(badges: Badge[]): Badge[] {
  return [...badges].sort((left, right) => {
    const progressDelta = (right.progress ?? 0) - (left.progress ?? 0);
    if (progressDelta !== 0) {
      return progressDelta;
    }
    return left.name.localeCompare(right.name);
  });
}
