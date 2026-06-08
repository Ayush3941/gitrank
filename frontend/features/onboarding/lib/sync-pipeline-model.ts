import { toRatioPercent } from "@/lib/formatters";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import type { SyncState } from "@/types/gitrank";

export const SYNC_PIPELINE_STEPS: readonly string[] = [
  "Connecting GitHub",
  "Fetching repositories",
  "Reading merged PRs",
  "Analyzing review depth",
  "Classifying contribution type",
  "Calculating PR intensity",
  "Assigning badges",
  "Building public profile",
];

const POLL_INTERVAL_STEPS_MS = [5000, 7000, 10000, 15000, 20000] as const;

export const INITIAL_SYNC_POLL_INTERVAL_MS = POLL_INTERVAL_STEPS_MS[0];

export type SyncPipelineModelInput = {
  syncState: SyncState;
  syncStartedAt: string | null;
  isSyncPending: boolean;
  hasProfileData: boolean;
  isProfileError: boolean;
  syncErrorMessage?: string;
  pollIntervalMs: number;
};

export function syncPollIntervalMs(attempt: number): number {
  if (attempt <= 0) {
    return POLL_INTERVAL_STEPS_MS[0];
  }
  const index = Math.min(attempt, POLL_INTERVAL_STEPS_MS.length - 1);
  return POLL_INTERVAL_STEPS_MS[index];
}

export function buildSyncPipelineModel({
  syncState,
  syncStartedAt,
  isSyncPending,
  hasProfileData,
  isProfileError,
  syncErrorMessage = "",
  pollIntervalMs,
}: SyncPipelineModelInput) {
  const isSynced = syncState === "synced";
  const completedSteps =
    isSynced ? SYNC_PIPELINE_STEPS.length : syncStartedAt || isSyncPending ? 3 : 1;
  const pipelineProgress = toRatioPercent(completedSteps / SYNC_PIPELINE_STEPS.length);
  const currentPhaseLabel =
    completedSteps < SYNC_PIPELINE_STEPS.length
      ? SYNC_PIPELINE_STEPS[completedSteps]
      : "Pipeline complete";
  const actionError = sanitizeUserFacingError(
    syncErrorMessage ||
      (isProfileError ? "Authenticated profile snapshot is loading. Retry in a moment." : ""),
    "onboarding-sync",
  );
  const canRetrySync =
    hasProfileData &&
    !isSyncPending &&
    syncState !== "syncing" &&
    isRecoverableSyncState(syncState);
  const pollCadenceSeconds = Math.max(5, Math.round(pollIntervalMs / 1000));

  return {
    steps: SYNC_PIPELINE_STEPS,
    isSynced,
    completedSteps,
    pipelineProgress,
    currentPhaseLabel,
    actionError,
    canRetrySync,
    pollCadenceSeconds,
  };
}

function isRecoverableSyncState(syncState: SyncState): boolean {
  return (
    syncState === "failed" ||
    syncState === "rate_limited" ||
    syncState === "stale" ||
    syncState === "partially_synced" ||
    syncState === "never_synced"
  );
}
