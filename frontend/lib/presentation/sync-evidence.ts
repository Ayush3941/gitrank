import type { UserProfile } from "@/types/gitrank";

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
): UserProfile["syncStatus"]["state"] {
  if (!user) {
    return "never_synced";
  }
  if (user.syncStatus.state === "synced" && !hasUserContributionEvidence(user)) {
    return "partially_synced";
  }
  return user.syncStatus.state;
}

export function shouldShowSyncRefreshPill(user: UserProfile | null | undefined): boolean {
  if (!user) {
    return false;
  }
  return deriveEffectiveSyncState(user) === "synced" && hasUserContributionEvidence(user);
}
