import { describe, expect, it } from "vitest";
import {
  shouldShowSyncStateGuide,
  syncStateGuideCopy,
  syncStateGuideState,
} from "@/components/shared/SyncStateGuide";

describe("syncStateGuideCopy", () => {
  it("returns an account-recovery CTA for failed sync state", () => {
    const copy = syncStateGuideCopy("failed");
    expect(copy.title).toContain("Sync failed");
    expect(copy.actionHref).toBe("/dashboard/settings");
  });

  it("returns contribution-lane CTA for syncing state", () => {
    const copy = syncStateGuideCopy("syncing");
    expect(copy.actionHref).toBe("/dashboard/contributions");
    expect(copy.actionLabel).toContain("contribution");
  });
});

describe("syncStateGuideState", () => {
  it("normalizes synced + partial snapshot into partially_synced guidance", () => {
    const state = syncStateGuideState({
      state: "synced",
      lastSyncedAt: "2026-05-19T00:00:00.000Z",
      currentStep: "",
      progress: 100,
      partialProfileAvailable: true,
    });
    expect(state).toBe("partially_synced");
  });

  it("keeps the original state when snapshot is not synced", () => {
    const state = syncStateGuideState({
      state: "failed",
      lastSyncedAt: "2026-05-19T00:00:00.000Z",
      currentStep: "",
      progress: 0,
      partialProfileAvailable: false,
    });
    expect(state).toBe("failed");
  });
});

describe("shouldShowSyncStateGuide", () => {
  it("shows guide for attention states and hides it for synced/stale", () => {
    expect(
      shouldShowSyncStateGuide({
        state: "syncing",
        lastSyncedAt: "2026-05-19T00:00:00.000Z",
        currentStep: "fetching",
        progress: 45,
        partialProfileAvailable: false,
      }),
    ).toBe(true);

    expect(
      shouldShowSyncStateGuide({
        state: "stale",
        lastSyncedAt: "2026-05-19T00:00:00.000Z",
        currentStep: "",
        progress: 0,
        partialProfileAvailable: false,
      }),
    ).toBe(false);

    expect(
      shouldShowSyncStateGuide({
        state: "synced",
        lastSyncedAt: "2026-05-19T00:00:00.000Z",
        currentStep: "",
        progress: 100,
        partialProfileAvailable: false,
      }),
    ).toBe(false);
  });

  it("shows guide when synced state still has partial profile availability", () => {
    expect(
      shouldShowSyncStateGuide({
        state: "synced",
        lastSyncedAt: "2026-05-19T00:00:00.000Z",
        currentStep: "",
        progress: 100,
        partialProfileAvailable: true,
      }),
    ).toBe(true);
  });
});
