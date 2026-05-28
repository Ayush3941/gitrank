function parsePositiveMs(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const integer = Math.trunc(value);
  if (integer < min || integer > max) {
    return fallback;
  }
  return integer;
}

function parsePositiveCount(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const integer = Math.trunc(value);
  if (integer < min || integer > max) {
    return fallback;
  }
  return integer;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== "string") {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

const MIN_INTERVAL_MS = 1_000;
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1_000;

const AUTO_SYNC_RETRY_INTERVAL_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_AUTO_SYNC_RETRY_INTERVAL_MS,
  90_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const AUTO_SYNC_STALE_AGE_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_AUTO_SYNC_STALE_AGE_MS,
  6 * 60 * 60 * 1_000,
  60_000,
  MAX_INTERVAL_MS,
);

const AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT,
  3,
  1,
  25,
);

const AUTO_SYNC_ATTEMPT_RECOVERY_COOLDOWN_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_AUTO_SYNC_ATTEMPT_RECOVERY_COOLDOWN_MS,
  10 * 60 * 1_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const AUTO_SYNC_SESSION_COOLDOWN_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_AUTO_SYNC_SESSION_COOLDOWN_MS,
  20 * 60 * 1_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const AUTO_SYNC_SESSION_BOOTSTRAP_ENABLED = parseBoolean(
  process.env.NEXT_PUBLIC_GITRANK_AUTO_SYNC_SESSION_BOOTSTRAP_ENABLED,
  true,
);

const PROFILE_SYNC_REFETCH_INTERVAL_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_PROFILE_SYNC_REFETCH_INTERVAL_MS,
  20_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const PROFILE_SYNC_REFETCH_INTERVAL_CONSTRAINED_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_PROFILE_SYNC_REFETCH_INTERVAL_CONSTRAINED_MS,
  75_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const PROFILE_SYNC_STALE_TIME_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_PROFILE_SYNC_STALE_TIME_MS,
  20_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const PROFILE_SYNC_STALE_TIME_CONSTRAINED_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_PROFILE_SYNC_STALE_TIME_CONSTRAINED_MS,
  60_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const SYNC_RUNS_IDLE_REFETCH_INTERVAL_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_SYNC_RUNS_IDLE_REFETCH_INTERVAL_MS,
  180_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS,
  45_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const SYNC_RUNS_IDLE_REFETCH_INTERVAL_CONSTRAINED_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_SYNC_RUNS_IDLE_REFETCH_INTERVAL_CONSTRAINED_MS,
  300_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_CONSTRAINED_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_CONSTRAINED_MS,
  90_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const SYNC_RUNS_STALE_TIME_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_SYNC_RUNS_STALE_TIME_MS,
  30_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const SYNC_RUNS_STALE_TIME_CONSTRAINED_MS = parsePositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_SYNC_RUNS_STALE_TIME_CONSTRAINED_MS,
  90_000,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
);

const PROFILE_SYNC_RUN_LOOKBACK_LIMIT = parsePositiveCount(
  process.env.NEXT_PUBLIC_GITRANK_PROFILE_SYNC_RUN_LOOKBACK_LIMIT,
  50,
  10,
  200,
);

export const syncPollingPolicy = {
  autoSyncRetryIntervalMs: AUTO_SYNC_RETRY_INTERVAL_MS,
  autoSyncStaleAgeMs: AUTO_SYNC_STALE_AGE_MS,
  autoSyncMaxAttemptsPerMount: AUTO_SYNC_MAX_ATTEMPTS_PER_MOUNT,
  autoSyncAttemptRecoveryCooldownMs: AUTO_SYNC_ATTEMPT_RECOVERY_COOLDOWN_MS,
  autoSyncSessionCooldownMs: AUTO_SYNC_SESSION_COOLDOWN_MS,
  autoSyncSessionBootstrapEnabled: AUTO_SYNC_SESSION_BOOTSTRAP_ENABLED,
  profileSyncRefetchIntervalMs: PROFILE_SYNC_REFETCH_INTERVAL_MS,
  profileSyncRefetchIntervalConstrainedMs: PROFILE_SYNC_REFETCH_INTERVAL_CONSTRAINED_MS,
  profileSyncStaleTimeMs: PROFILE_SYNC_STALE_TIME_MS,
  profileSyncStaleTimeConstrainedMs: PROFILE_SYNC_STALE_TIME_CONSTRAINED_MS,
  syncRunsIdleRefetchIntervalMs: SYNC_RUNS_IDLE_REFETCH_INTERVAL_MS,
  syncRunsActiveRefetchIntervalMs: SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_MS,
  syncRunsIdleRefetchIntervalConstrainedMs: SYNC_RUNS_IDLE_REFETCH_INTERVAL_CONSTRAINED_MS,
  syncRunsActiveRefetchIntervalConstrainedMs: SYNC_RUNS_ACTIVE_REFETCH_INTERVAL_CONSTRAINED_MS,
  syncRunsStaleTimeMs: SYNC_RUNS_STALE_TIME_MS,
  syncRunsStaleTimeConstrainedMs: SYNC_RUNS_STALE_TIME_CONSTRAINED_MS,
  profileSyncRunLookbackLimit: PROFILE_SYNC_RUN_LOOKBACK_LIMIT,
} as const;
