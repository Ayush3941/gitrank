import type { UserProfile } from "@/types/gitrank";
import {
  ACTIVE_SYNC_RUN_STATUSES,
  FAILED_SYNC_RUN_STATUSES,
  PARTIAL_SYNC_RUN_STATUSES,
  QUEUED_SYNC_RUN_STATUSES,
  normalizeSyncRunStatusToken,
} from "@/lib/sync/sync-run-status-policy";

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
    const hasPersistedEvidenceIdentity =
      row.scoreEventId?.trim().length ||
      row.pullRequestId?.trim().length ||
      row.reportEvidenceStatus?.trim().length;
    if (!hasPersistedEvidenceIdentity) {
      return false;
    }
    if (row.status !== "merged") {
      return false;
    }
    const mergedAtMillis = Date.parse(row.mergedAt);
    return Number.isFinite(mergedAtMillis) && mergedAtMillis > 0;
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
  // Repository rows alone can be present from lightweight sync passes without
  // score-bearing PR evidence. Treat contribution evidence as the sync-ready
  // source of truth for "fully synced" UX states.
  return hasUserContributionEvidence(user);
}

export function deriveEffectiveSyncState(
  user: UserProfile | null | undefined,
  syncRunStatuses?: readonly string[],
): UserProfile["syncStatus"]["state"] {
  if (!user) {
    return "never_synced";
  }
  if (hasLeadingPendingSyncRunStatus(syncRunStatuses)) {
    return "syncing";
  }
  const latestStatus = latestTerminalSyncRunStatus(syncRunStatuses);
  if (latestStatus && PARTIAL_SYNC_RUN_STATUSES.has(latestStatus)) {
    return "partially_synced";
  }
  if (latestStatus && FAILED_SYNC_RUN_STATUSES.has(latestStatus)) {
    return "failed";
  }
  const hasMaterializedEvidence = hasUserMaterializedSyncEvidence(user);
  if (!hasMaterializedEvidence && latestStatus === "completed") {
    return "partially_synced";
  }
  if (user.syncStatus.state === "synced" && !hasMaterializedEvidence) {
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

function hasLeadingPendingSyncRunStatus(
  syncRunStatuses: readonly string[] | undefined,
): boolean {
  const leadingStatus = leadingSyncRunStatus(syncRunStatuses);
  if (!leadingStatus) {
    return false;
  }
  return ACTIVE_SYNC_RUN_STATUSES.has(leadingStatus) || QUEUED_SYNC_RUN_STATUSES.has(leadingStatus);
}

function latestTerminalSyncRunStatus(syncRunStatuses: readonly string[] | undefined): string | null {
  if (!syncRunStatuses || syncRunStatuses.length === 0) {
    return null;
  }
  for (const rawStatus of syncRunStatuses) {
    const normalized = normalizeSyncRunStatusToken(rawStatus);
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

function leadingSyncRunStatus(syncRunStatuses: readonly string[] | undefined): string | null {
  if (!syncRunStatuses || syncRunStatuses.length === 0) {
    return null;
  }
  for (const rawStatus of syncRunStatuses) {
    const normalized = normalizeSyncRunStatusToken(rawStatus);
    if (!normalized) {
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
  return true;
}

function normalizeRunToken(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return normalizeSyncRunStatusToken(value);
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
