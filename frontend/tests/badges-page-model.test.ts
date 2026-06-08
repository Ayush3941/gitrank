import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBadgesStaleNotice,
  buildBadgesPageModel,
  resolveBadgePageSizes,
} from "@/features/badges/lib/badges-page-model";
import {
  buildBadge,
  buildProfileRepositorySummary,
  buildProfileViewData,
  buildUserProfile,
} from "@/tests/helpers/gitrank-fixtures";

describe("buildBadgesPageModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds shelf state, page sizes, streak, and ABRA request inputs", () => {
    const badges = [
      buildBadge({ id: "ship", name: "Ship", unlocked: true, rarity: "Rare" }),
      buildBadge({ id: "guard", name: "Guard", unlocked: false, rarity: "Epic", progress: 80 }),
      buildBadge({ id: "docs", name: "Docs", unlocked: true, rarity: "Common" }),
    ];
    const profile = buildProfileViewData({
      user: buildUserProfile({ badges }),
      topRepositories: [buildProfileRepositorySummary()],
    });
    const model = buildBadgesPageModel({
      badges,
      profile,
      rarity: "Rare",
      visibility: "Unlocked",
      deferredRarity: "All",
      deferredVisibility: "All",
      visibleBadgeCount: 2,
      visibleLockedCount: 1,
      constrainedNetwork: false,
      displaySyncState: "partially_synced",
      latestSyncOutcome: {
        code: "backfill_incomplete",
        message: "Historical authored PR backfill is still in progress.",
      },
    });

    expect(model.pageSizes).toEqual(resolveBadgePageSizes(false));
    expect(model.isFiltering).toBe(true);
    expect(model.filterState).toEqual({
      canResetFilters: true,
      activeFilterCount: 2,
    });
    expect(model.badgeShelf.totalCount).toBe(3);
    expect(model.badgeShelf.unlockedCount).toBe(2);
    expect(model.badgeShelf.visibleBadges.map((badge) => badge.id)).toEqual(["ship", "guard"]);
    expect(model.badgeShelf.visibleLockedBadges.map((badge) => badge.id)).toEqual(["guard"]);
    expect(model.streak.currentStreakDays).toBeGreaterThan(0);
    expect(model.fallbackArchetype).toBe("Quality Champion");
    expect(model.shouldShowStaleState).toBe(true);
    expect(model.staleNotice.message).toContain("scored PR evidence is still empty");
    expect(model.staleNotice.reasonMessage).toContain("Historical authored PR backfill");
    expect(model.abraPayload?.profile.badgeCount).toBe(2);
    expect(model.abraPayload?.badges.map((badge) => badge.id)).toEqual(["ship", "guard", "docs"]);
  });

  it("uses constrained page sizes and disables ABRA requests on constrained networks", () => {
    const badges = [
      buildBadge({ id: "ship", name: "Ship", unlocked: true }),
      buildBadge({ id: "guard", name: "Guard", unlocked: false }),
    ];
    const model = buildBadgesPageModel({
      badges,
      profile: buildProfileViewData({
        user: buildUserProfile({ badges, strongestSignals: ["Security"] }),
      }),
      rarity: "All",
      visibility: "All",
      deferredRarity: "All",
      deferredVisibility: "All",
      visibleBadgeCount: 6,
      visibleLockedCount: 4,
      constrainedNetwork: true,
    });

    expect(model.pageSizes).toEqual(resolveBadgePageSizes(true));
    expect(model.isFiltering).toBe(false);
    expect(model.filterState.canResetFilters).toBe(false);
    expect(model.shouldShowStaleState).toBe(false);
    expect(model.abraPayload).toBeNull();
    expect(model.fallbackArchetype).toBe("Guardian Engineer");
  });

  it("builds app-access-aware badge stale copy", () => {
    const notice = buildBadgesStaleNotice({
      displaySyncState: "stale",
      refreshedAt: "2026-06-08T10:00:00.000Z",
      latestSyncOutcome: {
        code: "app_installation_required",
        message: "GitHub App installation is required before badge evidence can update.",
      },
    });

    expect(notice.message).toContain("blocked until GitHub App access is restored");
    expect(notice.reasonMessage).toContain("installation is required");
  });
});
