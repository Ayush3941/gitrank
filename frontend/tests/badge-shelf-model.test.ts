import { describe, expect, it } from "vitest";
import {
  buildBadgeFilterState,
  buildBadgeShelfModel,
} from "@/features/badges/lib/badge-shelf-model";
import type { Badge } from "@/types/gitrank";

describe("buildBadgeFilterState", () => {
  it("counts active filters and reset eligibility", () => {
    expect(buildBadgeFilterState({ rarity: "All", visibility: "All" })).toEqual({
      canResetFilters: false,
      activeFilterCount: 0,
    });
    expect(buildBadgeFilterState({ rarity: "Rare", visibility: "Locked" })).toEqual({
      canResetFilters: true,
      activeFilterCount: 2,
    });
  });
});

describe("buildBadgeShelfModel", () => {
  it("deduplicates badges, filters shelf results, and paginates visible badges", () => {
    const model = buildBadgeShelfModel({
      badges: [
        buildBadge({ id: "builder-common", name: "Builder", rarity: "Common", unlocked: false }),
        buildBadge({ id: "builder-rare", name: "Builder", rarity: "Rare", unlocked: true }),
        buildBadge({ id: "tester", name: "Tester", rarity: "Rare", unlocked: false }),
        buildBadge({ id: "guardian", name: "Guardian", rarity: "Epic", unlocked: false }),
      ],
      rarity: "Rare",
      visibility: "All",
      visibleBadgeCount: 1,
      visibleLockedCount: 2,
    });

    expect(model.totalCount).toBe(3);
    expect(model.unlockedCount).toBe(1);
    expect(model.filtered.map((badge) => badge.id)).toEqual(["builder-rare", "tester"]);
    expect(model.visibleBadges.map((badge) => badge.id)).toEqual(["builder-rare"]);
    expect(model.hasMoreBadges).toBe(true);
    expect(model.remainingBadges).toBe(1);
    expect(model.completionPercent).toBe(33);
  });

  it("sorts locked badges by progress then name and exposes preview state", () => {
    const model = buildBadgeShelfModel({
      badges: [
        buildBadge({ id: "beta", name: "Beta", unlocked: false, progress: 80 }),
        buildBadge({ id: "alpha", name: "Alpha", unlocked: false, progress: 80 }),
        buildBadge({ id: "gamma", name: "Gamma", unlocked: false, progress: 20 }),
        buildBadge({ id: "ship", name: "Ship", unlocked: true, progress: 100 }),
      ],
      rarity: "All",
      visibility: "Locked",
      visibleBadgeCount: 10,
      visibleLockedCount: 2,
    });

    expect(model.filtered.map((badge) => badge.id)).toEqual(["beta", "alpha", "gamma"]);
    expect(model.lockedBadgesSorted.map((badge) => badge.id)).toEqual(["alpha", "beta", "gamma"]);
    expect(model.visibleLockedBadges.map((badge) => badge.id)).toEqual(["alpha", "beta"]);
    expect(model.lockedBadgePreview.map((badge) => badge.id)).toEqual(["alpha", "beta", "gamma"]);
    expect(model.hasMoreLockedBadges).toBe(true);
    expect(model.remainingLockedBadges).toBe(1);
    expect(model.nextUnlockTarget?.id).toBe("alpha");
  });
});

function buildBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: overrides.id ?? "badge-1",
    name: overrides.name ?? "Shipwright",
    rarity: overrides.rarity ?? "Common",
    description: overrides.description ?? "Evidence-backed contribution badge.",
    unlockCondition: overrides.unlockCondition ?? "Land a scored PR.",
    icon: overrides.icon ?? "bolt",
    unlocked: overrides.unlocked ?? true,
    earnedAt: overrides.earnedAt,
    progress: overrides.progress ?? (overrides.unlocked === false ? 0 : 100),
    evidencePrIds: overrides.evidencePrIds ?? [],
    rarityScore: overrides.rarityScore,
  };
}
