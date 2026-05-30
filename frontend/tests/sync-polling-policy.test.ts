import { afterEach, describe, expect, it, vi } from "vitest";

const LOOKBACK_KEY = "NEXT_PUBLIC_GITRANK_PROFILE_SYNC_RUN_LOOKBACK_LIMIT";
const originalLookback = process.env[LOOKBACK_KEY];

describe("sync polling policy", () => {
  afterEach(() => {
    if (typeof originalLookback === "undefined") {
      delete process.env[LOOKBACK_KEY];
    } else {
      process.env[LOOKBACK_KEY] = originalLookback;
    }
    vi.resetModules();
  });

  it("uses the default profile sync-run lookback when env is missing", async () => {
    delete process.env[LOOKBACK_KEY];
    vi.resetModules();

    const { syncPollingPolicy } = await import("@/lib/runtime/sync-polling-policy");
    expect(syncPollingPolicy.profileSyncRunLookbackLimit).toBe(50);
  });

  it("accepts a bounded profile sync-run lookback override", async () => {
    process.env[LOOKBACK_KEY] = "120";
    vi.resetModules();

    const { syncPollingPolicy } = await import("@/lib/runtime/sync-polling-policy");
    expect(syncPollingPolicy.profileSyncRunLookbackLimit).toBe(120);
  });

  it("falls back to default when lookback override is out of bounds", async () => {
    process.env[LOOKBACK_KEY] = "5";
    vi.resetModules();

    let syncPollingModule = await import("@/lib/runtime/sync-polling-policy");
    expect(syncPollingModule.syncPollingPolicy.profileSyncRunLookbackLimit).toBe(50);

    process.env[LOOKBACK_KEY] = "500";
    vi.resetModules();
    syncPollingModule = await import("@/lib/runtime/sync-polling-policy");
    expect(syncPollingModule.syncPollingPolicy.profileSyncRunLookbackLimit).toBe(50);
  });
});
