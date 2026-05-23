import type { Badge, BadgeRarity } from "@/types/gitrank";

const BADGE_RARITY_WEIGHT: Record<BadgeRarity, number> = {
  Common: 1,
  Uncommon: 2,
  Rare: 3,
  Epic: 4,
  Legendary: 5,
  Mythic: 6,
};

export function deduplicateBadgesByName(badges: Badge[]): Badge[] {
  const keyOrder: string[] = [];
  const bestByKey = new Map<string, Badge>();

  for (const badge of badges) {
    const key = normalizedBadgeKey(badge);
    if (!bestByKey.has(key)) {
      bestByKey.set(key, badge);
      keyOrder.push(key);
      continue;
    }
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, badge);
      continue;
    }
    if (isPreferredBadge(badge, existing)) {
      bestByKey.set(key, badge);
    }
  }

  return keyOrder
    .map((key) => bestByKey.get(key))
    .filter((badge): badge is Badge => Boolean(badge));
}

function isPreferredBadge(next: Badge, current: Badge): boolean {
  const nextUnlocked = next.unlocked ? 1 : 0;
  const currentUnlocked = current.unlocked ? 1 : 0;
  if (nextUnlocked !== currentUnlocked) {
    return nextUnlocked > currentUnlocked;
  }

  const nextRarity = BADGE_RARITY_WEIGHT[next.rarity] ?? 0;
  const currentRarity = BADGE_RARITY_WEIGHT[current.rarity] ?? 0;
  if (nextRarity !== currentRarity) {
    return nextRarity > currentRarity;
  }

  const nextProgress = next.progress ?? (next.unlocked ? 100 : 0);
  const currentProgress = current.progress ?? (current.unlocked ? 100 : 0);
  if (nextProgress !== currentProgress) {
    return nextProgress > currentProgress;
  }

  const nextEarnedAt = safeTime(next.earnedAt);
  const currentEarnedAt = safeTime(current.earnedAt);
  if (nextEarnedAt !== currentEarnedAt) {
    return nextEarnedAt > currentEarnedAt;
  }

  const nextEvidenceCount = next.evidencePrIds.length;
  const currentEvidenceCount = current.evidencePrIds.length;
  if (nextEvidenceCount !== currentEvidenceCount) {
    return nextEvidenceCount > currentEvidenceCount;
  }

  const nextRarityScore = next.rarityScore ?? 0;
  const currentRarityScore = current.rarityScore ?? 0;
  if (nextRarityScore !== currentRarityScore) {
    return nextRarityScore > currentRarityScore;
  }

  return false;
}

function normalizedBadgeKey(badge: Badge): string {
  const normalizedName = badge.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalizedName || badge.id;
}

function safeTime(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
