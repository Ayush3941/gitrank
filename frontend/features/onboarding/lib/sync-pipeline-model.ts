import { formatPluralCount, toRatioPercent } from "@/lib/formatters";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import type { SyncState } from "@/types/gitrank";

type SyncPipelineStep = {
  id: string;
  label: string;
};

const SYNC_PIPELINE_STEPS: readonly SyncPipelineStep[] = [
  { id: "connect-github", label: "Connecting GitHub" },
  { id: "fetch-repositories", label: "Fetching repositories" },
  { id: "read-merged-prs", label: "Reading merged PRs" },
  { id: "analyze-review-depth", label: "Analyzing review depth" },
  { id: "classify-contribution-type", label: "Classifying contribution type" },
  { id: "calculate-pr-intensity", label: "Calculating PR intensity" },
  { id: "assign-badges", label: "Assigning badges" },
  { id: "build-public-profile", label: "Building public profile" },
];

const POLL_INTERVAL_STEPS_MS = [5000, 7000, 10000, 15000, 20000] as const;

export const INITIAL_SYNC_POLL_INTERVAL_MS = POLL_INTERVAL_STEPS_MS[0];
const MAXIMUM_SYNC_POLL_INTERVAL_MS = POLL_INTERVAL_STEPS_MS[POLL_INTERVAL_STEPS_MS.length - 1];

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
      ? SYNC_PIPELINE_STEPS[completedSteps].label
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
  const pollCadenceLabel = formatSyncPollCadenceLabel(pollIntervalMs);

  return {
    steps: SYNC_PIPELINE_STEPS,
    isSynced,
    completedSteps,
    pipelineProgress,
    currentPhaseLabel,
    actionError,
    canRetrySync,
    pollCadenceSeconds,
    pollCadenceLabel,
    initialPollCadenceLabel: formatSyncPollCadenceLabel(INITIAL_SYNC_POLL_INTERVAL_MS),
    maximumPollCadenceLabel: formatSyncPollCadenceLabel(MAXIMUM_SYNC_POLL_INTERVAL_MS),
  };
}

function formatSyncPollCadenceLabel(intervalMs: number): string {
  const seconds = Math.max(1, Math.round(intervalMs / 1000));
  return formatPluralCount(seconds, "second");
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
