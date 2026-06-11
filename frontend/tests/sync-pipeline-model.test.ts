import { describe, expect, it } from "vitest";
import {
  buildSyncPipelineModel,
  INITIAL_SYNC_POLL_INTERVAL_MS,
  syncPollIntervalMs,
} from "@/features/onboarding/lib/sync-pipeline-model";

describe("buildSyncPipelineModel", () => {
  it("builds initial stale progress without exposing retry before profile data exists", () => {
    const model = buildSyncPipelineModel({
      syncState: "stale",
      syncStartedAt: null,
      isSyncPending: false,
      hasProfileData: false,
      isProfileError: false,
      pollIntervalMs: INITIAL_SYNC_POLL_INTERVAL_MS,
    });

    expect(model.completedSteps).toBe(1);
    expect(model.pipelineProgress).toBe(13);
    expect(model.currentPhaseLabel).toBe("Fetching repositories");
    expect(model.steps[0]).toEqual({
      id: "connect-github",
      label: "Connecting GitHub",
    });
    expect(model.pollCadenceSeconds).toBe(5);
    expect(model.pollCadenceLabel).toBe("5 seconds");
    expect(model.initialPollCadenceLabel).toBe("5 seconds");
    expect(model.maximumPollCadenceLabel).toBe("20 seconds");
    expect(model.canRetrySync).toBe(false);
    expect(model.actionError).toBe("");
  });

  it("marks active sync progress and allows retry for recoverable states", () => {
    const model = buildSyncPipelineModel({
      syncState: "rate_limited",
      syncStartedAt: "2026-06-08T12:00:00.000Z",
      isSyncPending: false,
      hasProfileData: true,
      isProfileError: false,
      pollIntervalMs: 15000,
    });

    expect(model.completedSteps).toBe(3);
    expect(model.pipelineProgress).toBe(38);
    expect(model.currentPhaseLabel).toBe("Analyzing review depth");
    expect(model.pollCadenceSeconds).toBe(15);
    expect(model.pollCadenceLabel).toBe("15 seconds");
    expect(model.canRetrySync).toBe(true);
  });

  it("builds complete progress and blocks retry once synced", () => {
    const model = buildSyncPipelineModel({
      syncState: "synced",
      syncStartedAt: "2026-06-08T12:00:00.000Z",
      isSyncPending: false,
      hasProfileData: true,
      isProfileError: false,
      pollIntervalMs: 20000,
    });

    expect(model.isSynced).toBe(true);
    expect(model.completedSteps).toBe(model.steps.length);
    expect(model.pipelineProgress).toBe(100);
    expect(model.currentPhaseLabel).toBe("Pipeline complete");
    expect(model.canRetrySync).toBe(false);
  });

  it("sanitizes technical sync errors before rendering", () => {
    const model = buildSyncPipelineModel({
      syncState: "failed",
      syncStartedAt: null,
      isSyncPending: false,
      hasProfileData: true,
      isProfileError: false,
      syncErrorMessage: "User sync failed. Status 500.",
      pollIntervalMs: 5000,
    });

    expect(model.actionError).toBe(
      "Sync failed for now. Keep this page open and retry shortly while background refresh continues.",
    );
  });
});

describe("syncPollIntervalMs", () => {
  it("ramps polling cadence and caps at the slowest interval", () => {
    expect(syncPollIntervalMs(0)).toBe(5000);
    expect(syncPollIntervalMs(1)).toBe(7000);
    expect(syncPollIntervalMs(3)).toBe(15000);
    expect(syncPollIntervalMs(99)).toBe(20000);
  });
});
