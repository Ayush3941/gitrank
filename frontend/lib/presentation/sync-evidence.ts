import type { UserProfile } from "@/types/gitrank";

const ACTIVE_SYNC_RUN_STATUSES = new Set(["running", "syncing", "in_progress"]);
const QUEUED_SYNC_RUN_STATUSES = new Set(["queued", "pending"]);
const FAILED_SYNC_RUN_STATUSES = new Set(["failed", "cancelled", "canceled", "timed_out", "timeout"]);
const PARTIAL_SYNC_RUN_STATUSES = new Set(["partial"]);

export function hasUserContributionEvidence(user: UserProfile | null | undefined): boolean {
  if (!user) {
    return false;
  }
  if (user.mergedPrCount > 0) {
    return true;
  }
  return user.contributions.some((row) => {
    if (row.number <= 0) {
      return false;
    }
    if (!row.owner || row.owner === "unknown") {
      return false;
    }
    if (!row.repo || row.repo === "repo") {
      return false;
    }
    return row.xpEarned !== 0 || row.status === "merged";
  });
}

export function hasUserRepositoryEvidence(user: UserProfile | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return user.repositories.some((repository) => {
    const name = repository.name?.trim();
    if (!name || !repository.tracked) {
      return false;
    }
    if (name === "owner/repository" || name === "unknown/repo") {
      return false;
    }
    return name.includes("/");
  });
}

export function hasUserMaterializedSyncEvidence(user: UserProfile | null | undefined): boolean {
  return hasUserContributionEvidence(user) || hasUserRepositoryEvidence(user);
}

export function deriveEffectiveSyncState(
  user: UserProfile | null | undefined,
  syncRunStatuses?: readonly string[],
): UserProfile["syncStatus"]["state"] {
  if (!user) {
    return "never_synced";
  }
  if (hasPendingSyncRunStatuses(syncRunStatuses)) {
    return "syncing";
  }
  const latestStatus = latestTerminalSyncRunStatus(syncRunStatuses);
  if (latestStatus && PARTIAL_SYNC_RUN_STATUSES.has(latestStatus)) {
    return "partially_synced";
  }
  if (latestStatus && FAILED_SYNC_RUN_STATUSES.has(latestStatus)) {
    return "failed";
  }
  if (user.syncStatus.state === "synced" && !hasUserMaterializedSyncEvidence(user)) {
    return "partially_synced";
  }
  return user.syncStatus.state;
}

export function shouldShowSyncRefreshPill(
  user: UserProfile | null | undefined,
  syncRunStatuses?: readonly string[],
): boolean {
  if (!user) {
    return false;
  }
  return deriveEffectiveSyncState(user, syncRunStatuses) === "synced" && hasUserMaterializedSyncEvidence(user);
}

function hasPendingSyncRunStatuses(syncRunStatuses: readonly string[] | undefined): boolean {
  if (!syncRunStatuses || syncRunStatuses.length === 0) {
    return false;
  }
  for (const rawStatus of syncRunStatuses) {
    const normalized = rawStatus.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (ACTIVE_SYNC_RUN_STATUSES.has(normalized) || QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
      return true;
    }
  }
  return false;
}

function latestTerminalSyncRunStatus(syncRunStatuses: readonly string[] | undefined): string | null {
  if (!syncRunStatuses || syncRunStatuses.length === 0) {
    return null;
  }
  for (const rawStatus of syncRunStatuses) {
    const normalized = rawStatus.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (ACTIVE_SYNC_RUN_STATUSES.has(normalized) || QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
      continue;
    }
    return normalized;
  }
  return null;
}
