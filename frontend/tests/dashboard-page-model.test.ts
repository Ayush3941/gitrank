import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDashboardPageModel } from "@/features/dashboard/lib/dashboard-page-model";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import {
  buildBadge,
  buildRepositoryVisibility,
  buildUserProfile,
} from "@/tests/helpers/gitrank-fixtures";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";

describe("buildDashboardPageModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds streak, deterministic fallback, ABRA payload, and stale notice inputs", () => {
    const latestSyncOutcome: SyncRunDiagnostic = {
      code: "backfill_incomplete",
      message: "Historical authored PR backfill is still in progress.",
    };
    const user = buildUserProfile({
      contributions: [
        buildContribution({
          id: "today",
          mergedAt: "2026-06-08T09:00:00.000Z",
          title: "Today PR",
        }),
        buildContribution({
          id: "yesterday",
          mergedAt: "2026-06-07T09:00:00.000Z",
          title: "Yesterday PR",
        }),
      ],
      badges: [
        buildBadge({ id: "ship", name: "Shipwright", unlocked: true }),
        buildBadge({ id: "lock", name: "Locked Path", unlocked: false }),
      ],
      repositories: [
        buildRepositoryVisibility({ name: "octo/gitrank" }),
        buildRepositoryVisibility({ name: "octo/api" }),
      ],
    });

    const model = buildDashboardPageModel({
      user,
      isStale: true,
      trendWindowLabel: "last_6_weeks",
      refreshedAt: "2026-06-08T10:00:00.000Z",
      displaySyncState: "partially_synced",
      latestSyncOutcome,
      constrainedNetwork: false,
    });

    expect(model.streak.currentStreakDays).toBe(2);
    expect(model.fallbackArchetype).toBe("Quality Champion");
    expect(model.fallbackIdentitySummary).toContain("Octo Cat is currently Bronze I");
    expect(model.fallbackIdentitySummary).toContain("snapshot is currently marked stale");
    expect(model.abraPayload?.profile).toMatchObject({
      username: "octocat",
      badgeCount: 1,
      repositoriesTouched: 2,
      streakDays: 2,
    });
    expect(model.abraPayload?.contributions.map((row) => row.id)).toEqual(["today", "yesterday"]);
    expect(model.staleNotice?.message).toContain("scored PR evidence is still incomplete");
    expect(model.staleNotice?.reasonMessage).toContain("Historical authored PR backfill");
  });

  it("keeps deterministic identity available but disables ABRA on constrained networks", () => {
    const model = buildDashboardPageModel({
      user: buildUserProfile({ strongestSignals: ["Security"] }),
      displaySyncState: "synced",
      latestSyncOutcome: null,
      constrainedNetwork: true,
    });

    expect(model.abraPayload).toBeNull();
    expect(model.fallbackArchetype).toBe("Guardian Engineer");
    expect(model.fallbackIdentitySummary).toContain("Octo Cat is currently Bronze I");
    expect(model.staleNotice).toBeNull();
  });

  it("returns safe defaults before dashboard data is available", () => {
    const model = buildDashboardPageModel({
      user: null,
      displaySyncState: "syncing",
      latestSyncOutcome: null,
      constrainedNetwork: false,
    });

    expect(model.streak.currentStreakDays).toBe(0);
    expect(model.abraPayload).toBeNull();
    expect(model.fallbackArchetype).toBe("Systems Builder");
    expect(model.fallbackIdentitySummary).toBeUndefined();
    expect(model.staleNotice).toBeNull();
  });
});
