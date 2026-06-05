import { describe, expect, it } from "vitest";
import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";

describe("buildStaleSyncNotice", () => {
  it("returns GitHub App blocker messaging for partially synced app-installation failures", () => {
    const notice = buildStaleSyncNotice({
      syncState: "partially_synced",
      refreshedAt: "2026-05-31T21:00:00Z",
      latestSyncOutcome: {
        code: "app_installation_required",
        message: "GitHub App installation is required for PR sync.",
      },
      snapshotLabel: "Badge snapshot",
      partialFallback: "partial fallback",
      staleFallback: "stale fallback",
    });

    expect(notice.message).toBe(
      "Sync is blocked until GitHub App installation access is available for this account.",
    );
    expect(notice.reasonMessage).toBe("GitHub App installation is required for PR sync.");
  });

  it("returns fallback stale messaging when no blocker is present", () => {
    const notice = buildStaleSyncNotice({
      syncState: "stale",
      refreshedAt: "2026-05-31T21:00:00Z",
      latestSyncOutcome: null,
      snapshotLabel: "Quest snapshot",
      partialFallback: "partial fallback",
      staleFallback: "Live quest signals may lag until the next sync completes.",
    });

    expect(notice.message).toContain("Quest snapshot refreshed");
    expect(notice.message).toContain("Live quest signals may lag until the next sync completes.");
    expect(notice.reasonMessage).toBeUndefined();
  });

  it("does not invent a fresh timestamp when snapshot refresh time is missing", () => {
    const notice = buildStaleSyncNotice({
      syncState: "stale",
      latestSyncOutcome: null,
      snapshotLabel: "Contribution evidence",
      partialFallback: "partial fallback",
      staleFallback: "New PR rows appear after sync completes.",
    });

    expect(notice.message).toBe(
      "Contribution evidence refresh time is unavailable. New PR rows appear after sync completes.",
    );
    expect(notice.message).not.toContain("Just now");
  });

  it("returns blocker-aware stale messaging when app access is unavailable", () => {
    const notice = buildStaleSyncNotice({
      syncState: "stale",
      refreshedAt: "2026-05-31T21:00:00Z",
      latestSyncOutcome: {
        code: "app_runtime_required",
        message: "Strict GitHub App runtime is required before extracting contribution data.",
      },
      snapshotLabel: "Leaderboard context",
      partialFallback: "partial fallback",
      staleFallback: "stale fallback",
    });

    expect(notice.message).toContain("Leaderboard context refreshed");
    expect(notice.message).toContain("blocked until GitHub App access is restored");
    expect(notice.reasonMessage).toBe(
      "Strict GitHub App runtime is required before extracting contribution data.",
    );
  });

  it("keeps app-access blocker guidance honest when refresh time is missing", () => {
    const notice = buildStaleSyncNotice({
      syncState: "stale",
      latestSyncOutcome: {
        code: "app_runtime_required",
        message: "Strict GitHub App runtime is required before extracting contribution data.",
      },
      snapshotLabel: "Leaderboard context",
      partialFallback: "partial fallback",
      staleFallback: "stale fallback",
    });

    expect(notice.message).toBe(
      "Leaderboard context refresh time is unavailable, but new PR evidence is blocked until GitHub App access is restored.",
    );
    expect(notice.message).not.toContain("Just now");
  });
});
