import type { UserProfile } from "@/types/gitrank";

const ACTIVE_SYNC_RUN_STATUSES = new Set(["running", "syncing", "in_progress"]);
const QUEUED_SYNC_RUN_STATUSES = new Set(["queued", "pending"]);

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
  if (user.syncStatus.state === "synced" && !hasUserContributionEvidence(user)) {
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
  return deriveEffectiveSyncState(user, syncRunStatuses) === "synced" && hasUserContributionEvidence(user);
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
