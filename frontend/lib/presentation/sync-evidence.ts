import type { UserProfile } from "@/types/gitrank";

const ACTIVE_SYNC_RUN_STATUSES = new Set(["running", "syncing", "in_progress"]);
const QUEUED_SYNC_RUN_STATUSES = new Set(["queued", "pending"]);
const FAILED_SYNC_RUN_STATUSES = new Set(["failed", "cancelled", "canceled", "timed_out", "timeout"]);
const PARTIAL_SYNC_RUN_STATUSES = new Set(["partial"]);
const PROFILE_SYNC_RUN_TYPES = new Set([
  "",
  "user",
  "repository",
  "pull_request",
  "review",
  "issue",
  "commit",
  "installation",
]);

export type ProfileSyncRunStatusSource = {
  status?: string | null;
  run_type?: string | null;
  subject?: string | null;
  requested_user?: string | null;
  requested_by_github_login?: string | null;
};

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

export function selectProfileSyncRunStatuses(
  runs: readonly ProfileSyncRunStatusSource[] | null | undefined,
  user: UserProfile | null | undefined,
): string[] {
  if (!runs || runs.length === 0) {
    return [];
  }
  const normalizedUser = normalizeGitHubLoginToken(user?.username);
  const statuses: string[] = [];
  for (const run of runs) {
    const status = normalizeRunToken(run.status);
    if (!status) {
      continue;
    }
    if (!isProfileSyncRun(run, normalizedUser)) {
      continue;
    }
    statuses.push(status);
  }
  return statuses;
}

function hasPendingSyncRunStatuses(syncRunStatuses: readonly string[] | undefined): boolean {
  if (!syncRunStatuses || syncRunStatuses.length === 0) {
    return false;
  }
  let sawTerminalStatus = false;
  for (const rawStatus of syncRunStatuses) {
    const normalized = rawStatus.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (ACTIVE_SYNC_RUN_STATUSES.has(normalized) || QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
      // Only treat pending status as active when it appears before any terminal
      // status in the reverse-chronological run list.
      if (!sawTerminalStatus) {
        return true;
      }
      continue;
    }
    sawTerminalStatus = true;
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

function isProfileSyncRun(run: ProfileSyncRunStatusSource, normalizedUser: string): boolean {
  const runType = normalizeRunToken(run.run_type);
  if (!PROFILE_SYNC_RUN_TYPES.has(runType)) {
    return false;
  }
  if (!normalizedUser) {
    return true;
  }
  const requestedUser = normalizeGitHubLoginToken(run.requested_user);
  if (requestedUser) {
    return requestedUser === normalizedUser;
  }
  const requestedByGitHubLogin = normalizeGitHubLoginToken(run.requested_by_github_login);
  if (requestedByGitHubLogin) {
    return requestedByGitHubLogin === normalizedUser;
  }
  const subjectUser = normalizeSubjectGitHubLogin(run.subject);
  if (subjectUser) {
    return subjectUser === normalizedUser;
  }
  if (runType == "user") {
    return true;
  }
  return false;
}

function normalizeRunToken(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().toLowerCase();
}

function normalizeGitHubLoginToken(value: string | null | undefined): string {
  const normalized = normalizeRunToken(value);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/^@+/, "");
}

function normalizeSubjectGitHubLogin(value: string | null | undefined): string {
  const normalized = normalizeRunToken(value);
  if (!normalized) {
    return "";
  }
  if (!normalized.startsWith("@")) {
    return "";
  }
  return normalized.replace(/^@+/, "");
}
