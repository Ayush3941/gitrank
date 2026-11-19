import { describe, expect, it, vi } from "vitest";

// A stale deployment variable must not silently retune the shared polling policy.
describe("sync polling policy", () => {
  it("keeps the sync-run evidence window fixed when legacy env is present", async () => {
    vi.stubEnv("NEXT_PUBLIC_GITRANK_PROFILE_SYNC_RUN_LOOKBACK_LIMIT", "120");
    vi.resetModules();
    try {
      const { syncPollingPolicy } = await import("@/lib/runtime/sync-polling-policy");
      expect(syncPollingPolicy.profileSyncRunLookbackLimit).toBe(50);
      expect(syncPollingPolicy.autoSyncStaleAgeMs).toBeGreaterThan(syncPollingPolicy.autoSyncRetryIntervalMs);
      expect(syncPollingPolicy.syncRunsActiveRefetchIntervalConstrainedMs).toBeGreaterThanOrEqual(
        syncPollingPolicy.syncRunsActiveRefetchIntervalMs,
      );
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
