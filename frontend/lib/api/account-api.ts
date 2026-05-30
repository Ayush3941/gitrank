import { frontendPolicy } from "@/lib/runtime/frontend-policy";
import { hasPartialSyncRunMetrics } from "@/lib/sync/sync-run-metrics-policy";
import {
  appSyncFailureMessage,
  deriveAppSyncFailureCodeFromApiError,
} from "@/lib/sync/app-sync-failure";
import {
  ACTIVE_SYNC_RUN_STATUSES,
  COMPLETED_SYNC_RUN_STATUSES,
  FAILED_SYNC_RUN_STATUSES,
  PARTIAL_SYNC_RUN_STATUSES,
  QUEUED_SYNC_RUN_STATUSES,
  normalizeSyncRunStatusToken,
} from "@/lib/sync/sync-run-status-policy";

const DEFAULT_CSRF_COOKIE_NAME = frontendPolicy.csrfCookieName;
const USER_SYNC_EXECUTION_TIMEOUT_MS = parseBoundedPositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_USER_SYNC_EXECUTION_TIMEOUT_MS,
  120_000,
  90_000,
  600_000,
);
const USER_SYNC_RETRY_MAX_ATTEMPTS = parseBoundedPositiveInt(
  process.env.NEXT_PUBLIC_GITRANK_USER_SYNC_RETRY_MAX_ATTEMPTS,
  2,
  1,
  4,
);
const USER_SYNC_RETRY_BASE_DELAY_MS = parseBoundedPositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_USER_SYNC_RETRY_BASE_DELAY_MS,
  700,
  100,
  10_000,
);
const USER_SYNC_RETRY_JITTER_MS = parseBoundedPositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_USER_SYNC_RETRY_JITTER_MS,
  250,
  0,
  2_000,
);
const USER_SYNC_RETRY_MAX_DELAY_MS = parseBoundedPositiveMs(
  process.env.NEXT_PUBLIC_GITRANK_USER_SYNC_RETRY_MAX_DELAY_MS,
  8_000,
  500,
  60_000,
);
const SYNC_RUN_ACTIVE_WINDOW_MS = Math.max(120_000, USER_SYNC_EXECUTION_TIMEOUT_MS + 30_000);
const SYNC_RUN_QUEUED_WINDOW_MS = Math.max(180_000, SYNC_RUN_ACTIVE_WINDOW_MS * 2);
const USER_SYNC_SELF_KEY = "__self__";
const inFlightUserSyncRequests = new Map<string, Promise<ApiSyncExecutionResponse>>();
const USER_SYNC_RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ApiSyncResponse = {
  status: string;
  job_id?: string;
  correlation_id?: string;
  accepted_at: string;
};

export type ApiAccountLinkStartResponse = {
  provider: string;
  client_mode: string;
  intent: string;
  authorize_url: string;
  return_to?: string;
  expires_at: string;
};

export type ApiSyncExecutionResponse = {
  status: string;
  mode: string;
  user?: string;
  repository?: string;
  installation?: number;
  number?: number;
  sha?: string;
  correlation_id?: string;
  started_at: string;
  finished_at: string;
  fetched?: Record<string, number>;
  persisted?: Record<string, number>;
};

export type ApiSyncRunRecord = {
  id: string;
  run_type: string;
  status: string;
  subject?: string;
  requested_repository?: string;
  requested_user?: string;
  requested_by_subject?: string;
  requested_by_github_login?: string;
  installation?: number;
  delivery_id?: string;
  correlation_id?: string;
  started_at: string;
  finished_at?: string;
  last_error?: string;
  metrics?: Record<string, number>;
};

export type ApiSyncRunListResponse = {
  runs?: ApiSyncRunRecord[];
  last_updated_at?: string;
  last_attempted_at?: string;
  last_successful_at?: string;
};

export type ListSyncRunsOptions = {
  runType?: string;
  status?: string;
  user?: string;
  repository?: string;
  correlationId?: string;
};

export type QueueSyncInput = {
  mode:
    | "installation"
    | "user"
    | "repository"
    | "pull_request"
    | "review"
    | "issue"
    | "commit";
  installationId?: number;
  user?: string;
  repository?: string;
  number?: number;
  sha?: string;
};

type SyncExecutionAuthContext = {
  user?: string;
  installationId?: number;
};

type ApiAccountUnlinkResponse = {
  status: string;
  logged_out: boolean;
  reauthorize_at?: string;
};

type ApiAccountDeletionResponse = {
  status: string;
  logged_out: boolean;
  deleted_at: string;
};

type ApiLogoutResponse = {
  status: string;
};

export type AccountDataExport = {
  export_version: string;
  generated_at: string;
  user: {
    public_handle: string;
    display_name: string;
  };
  profile: unknown;
  github_accounts?: unknown[];
  sessions?: unknown[];
  audit_events?: unknown[];
  redactions?: string[];
};

export async function requestProfileSync(): Promise<ApiSyncResponse> {
  return queueSyncRequest({ mode: "user" });
}

export async function queueSyncRequest(input: QueueSyncInput): Promise<ApiSyncResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      mode: input.mode,
      installation_id: input.installationId,
      user: input.user,
      repository: input.repository,
      number: input.number,
      sha: input.sha,
    }),
  });
  return adaptJSON<ApiSyncResponse>(response, "Sync request failed.");
}

export async function listMySyncRuns(
  limit = 25,
  options: ListSyncRunsOptions = {},
): Promise<ApiSyncRunListResponse> {
  const params = new URLSearchParams();
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 25;
  params.set("limit", String(normalizedLimit));
  const runType = normalizeSyncRunFilterToken(options.runType);
  if (runType) {
    params.set("run_type", runType);
  }
  const status = normalizeSyncRunFilterToken(options.status);
  if (status) {
    params.set("status", status);
  }
  const user = normalizeSyncRunFilterUser(options.user);
  if (user) {
    params.set("user", user);
  }
  const repository = normalizeSyncRunFilterRepository(options.repository);
  if (repository) {
    params.set("repository", repository);
  }
  const correlationID = options.correlationId?.trim();
  if (correlationID) {
    params.set("correlation_id", correlationID);
  }

  const response = await fetch(`/api/sync/runs?${params.toString()}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await adaptJSON<ApiSyncRunListResponse>(response, "Sync activity request failed.");
  return normalizeSyncRunListResponse(payload, Date.now());
}

export async function startAccountLink(
  returnTo: string,
): Promise<ApiAccountLinkStartResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/account/link/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      return_to: returnTo,
    }),
  });
  return adaptJSON<ApiAccountLinkStartResponse>(response, "Account link start failed.");
}

export async function runRepositorySync(
  repository: string,
  context?: SyncExecutionAuthContext,
): Promise<ApiSyncExecutionResponse> {
  const syncContext = normalizeSyncExecutionContext(context);
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/repository", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      repository,
      ...syncContext,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Repository sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "repository"),
  });
}

export async function runUserSync(user?: string): Promise<ApiSyncExecutionResponse> {
  const normalizedUser = typeof user === "string" ? user.trim() : "";
  const dedupeKey = normalizedUser || USER_SYNC_SELF_KEY;
  const inFlight = inFlightUserSyncRequests.get(dedupeKey);
  if (inFlight) {
    return inFlight;
  }

  const request = (async (): Promise<ApiSyncExecutionResponse> => {
    const csrfToken = requireCSRFToken();
    let attemptedSessionRefreshRecovery = false;
    for (let attempt = 1; attempt <= USER_SYNC_RETRY_MAX_ATTEMPTS; attempt += 1) {
      let response: Response;
      try {
        response = await fetchWithTimeout(
          "/api/sync/user",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": csrfToken,
            },
            credentials: "same-origin",
            cache: "no-store",
            body: JSON.stringify({
              user: normalizedUser || undefined,
            }),
          },
          USER_SYNC_EXECUTION_TIMEOUT_MS,
        );
      } catch (error) {
        if (
          attempt < USER_SYNC_RETRY_MAX_ATTEMPTS &&
          isRetryableUserSyncTransportError(error)
        ) {
          await sleep(userSyncRetryDelayMs(attempt));
          continue;
        }
        if (isAbortLikeError(error)) {
          throw new Error(syncRecoveryMessage("user", "GitHub took too long to respond."));
        }
        throw error;
      }
      if (response.ok) {
        return (await response.json()) as ApiSyncExecutionResponse;
      }

      const parsed = await parseErrorResponse(response, "User sync failed.");
      if (
        !attemptedSessionRefreshRecovery &&
        isGitHubSessionRecoveryFailure(response.status, parsed.code, parsed.message)
      ) {
        attemptedSessionRefreshRecovery = true;
        const refreshed = await tryRefreshSessionForUserSync(csrfToken);
        if (refreshed) {
          continue;
        }
      }
      if (
        attempt < USER_SYNC_RETRY_MAX_ATTEMPTS &&
        isRetryableUserSyncUpstreamFailure(response.status, parsed.code, parsed.message)
      ) {
        await sleep(userSyncRetryDelayMs(attempt, response.headers.get("Retry-After")));
        continue;
      }
      throw new Error(
        sanitizeSyncExecutionError(parsed.message, response.status, parsed.code, "user"),
      );
    }
    throw new Error(syncRecoveryMessage("user", "Sync services are temporarily unavailable."));
  })();

  inFlightUserSyncRequests.set(dedupeKey, request);
  try {
    return await request;
  } finally {
    inFlightUserSyncRequests.delete(dedupeKey);
  }
}

export async function runInstallationSync(
  installationId: number,
): Promise<ApiSyncExecutionResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/installation", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      installation_id: installationId,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Installation sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "installation"),
  });
}

export async function runPullRequestSync(
  repository: string,
  number: number,
  context?: SyncExecutionAuthContext,
): Promise<ApiSyncExecutionResponse> {
  const syncContext = normalizeSyncExecutionContext(context);
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/pull-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      repository,
      number,
      ...syncContext,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Pull request sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "pull_request"),
  });
}

export async function runReviewSync(
  repository: string,
  number: number,
  context?: SyncExecutionAuthContext,
): Promise<ApiSyncExecutionResponse> {
  const syncContext = normalizeSyncExecutionContext(context);
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      repository,
      number,
      ...syncContext,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Review sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "review"),
  });
}

export async function runIssueSync(
  repository: string,
  number: number,
  context?: SyncExecutionAuthContext,
): Promise<ApiSyncExecutionResponse> {
  const syncContext = normalizeSyncExecutionContext(context);
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/issue", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      repository,
      number,
      ...syncContext,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Issue sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "issue"),
  });
}

export async function runCommitSync(
  repository: string,
  sha: string,
  context?: SyncExecutionAuthContext,
): Promise<ApiSyncExecutionResponse> {
  const syncContext = normalizeSyncExecutionContext(context);
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/commit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      repository,
      sha,
      ...syncContext,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Commit sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "commit"),
  });
}

export async function unlinkMyAccount(): Promise<ApiAccountUnlinkResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/account/unlink", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({}),
  });
  return adaptJSON<ApiAccountUnlinkResponse>(response, "Account disconnect failed.");
}

export async function deleteMyAccount(): Promise<ApiAccountDeletionResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      confirmation: "DELETE",
    }),
  });
  return adaptJSON<ApiAccountDeletionResponse>(response, "Account deletion failed.");
}

export async function exportMyAccountData(): Promise<AccountDataExport> {
  const response = await fetch("/api/account/export", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  return adaptJSON<AccountDataExport>(response, "Account export failed.");
}

export async function logoutCurrentSession(): Promise<ApiLogoutResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/session/logout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({}),
  });
  return adaptJSON<ApiLogoutResponse>(response, "Session logout failed.");
}

type AdaptJSONOptions = {
  transformError?: (message: string, status: number, code?: string) => string;
};

async function adaptJSON<T>(response: Response, fallback: string, options?: AdaptJSONOptions): Promise<T> {
  if (!response.ok) {
    const parsed = await parseErrorResponse(response, fallback);
    const message = options?.transformError
      ? options.transformError(parsed.message, response.status, parsed.code)
      : parsed.message;
    throw new Error(message);
  }
  return (await response.json()) as T;
}

async function parseErrorResponse(
  response: Response,
  fallback: string,
): Promise<{ message: string; code?: string }> {
  const defaultMessage = `${fallback} Status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return {
      message: body.error?.message?.trim() || defaultMessage,
      code: body.error?.code?.trim(),
    };
  } catch {
    return { message: defaultMessage };
  }
}

function normalizeSyncRunListResponse(payload: ApiSyncRunListResponse, nowMs: number): ApiSyncRunListResponse {
  const runs = Array.isArray(payload.runs) ? payload.runs : [];
  const normalizedRuns = runs
    .map((run) => normalizeSyncRunRecord(run, nowMs))
    .sort((left, right) => {
      const leftStarted = parseISOEpochMs(left.started_at) ?? 0;
      const rightStarted = parseISOEpochMs(right.started_at) ?? 0;
      if (leftStarted !== rightStarted) {
        return rightStarted - leftStarted;
      }
      return left.id.localeCompare(right.id);
    });
  return {
    ...payload,
    runs: normalizedRuns,
  };
}

function normalizeSyncRunRecord(run: ApiSyncRunRecord, nowMs: number): ApiSyncRunRecord {
  const finishedMs = parseISOEpochMs(run.finished_at);
  const startedMs = parseISOEpochMs(run.started_at);
  const normalizedStatus = normalizeSyncRunStatusToken(run.status);
  let normalized = normalizedStatus;
  let lastError = run.last_error;

  if (finishedMs !== null) {
    if (!normalized) {
      normalized = "completed";
    } else if (PARTIAL_SYNC_RUN_STATUSES.has(normalized)) {
      normalized = "partial";
    } else if (FAILED_SYNC_RUN_STATUSES.has(normalized)) {
      normalized = "failed";
    } else if (ACTIVE_SYNC_RUN_STATUSES.has(normalized) || QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
      normalized = "failed";
      if (!lastError?.trim()) {
        lastError = "sync execution finished with a non-terminal status and was marked failed";
      }
    } else if (COMPLETED_SYNC_RUN_STATUSES.has(normalized)) {
      normalized = "completed";
    }
  } else if (!normalized) {
    if (startedMs === null) {
      normalized = "queued";
    } else if (nowMs - startedMs > SYNC_RUN_ACTIVE_WINDOW_MS) {
      normalized = "failed";
      if (!lastError?.trim()) {
        lastError = "sync execution exceeded active window and was marked failed";
      }
    } else {
      normalized = "running";
    }
  } else if (ACTIVE_SYNC_RUN_STATUSES.has(normalized)) {
    if (startedMs === null || nowMs - startedMs > SYNC_RUN_ACTIVE_WINDOW_MS) {
      normalized = "failed";
      if (!lastError?.trim()) {
        lastError =
          startedMs === null
            ? "sync execution is missing started_at and was marked failed"
            : "sync execution exceeded active window and was marked failed";
      }
    } else {
      normalized = "running";
    }
  } else if (QUEUED_SYNC_RUN_STATUSES.has(normalized)) {
    normalized = "queued";
    if (startedMs !== null && nowMs - startedMs > SYNC_RUN_QUEUED_WINDOW_MS) {
      normalized = "failed";
      if (!lastError?.trim()) {
        lastError = "sync execution remained queued beyond safe window and was marked failed";
      }
    }
  }

  if (
    normalized === "completed" &&
    normalizeSyncRunFilterToken(run.run_type) === "user" &&
    shouldMarkUserSyncRunPartialByMetrics(run.metrics)
  ) {
    normalized = "partial";
    if (!lastError?.trim()) {
      lastError = "sync execution was normalized to partial because authored PR discovery remained incomplete";
    }
  }

  if (normalized === normalizedStatus && lastError === run.last_error) {
    return run;
  }

  return {
    ...run,
    status: normalized || run.status,
    last_error: lastError,
  };
}

function shouldMarkUserSyncRunPartialByMetrics(
  metrics?: Record<string, number>,
): boolean {
  return hasPartialSyncRunMetrics(metrics);
}

function sanitizeSyncExecutionError(
  message: string,
  status: number,
  code: string | undefined,
  mode: "user" | "repository" | "installation" | "pull_request" | "review" | "issue" | "commit",
): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("context deadline exceeded") || normalized.includes("client.timeout exceeded")) {
    return syncRecoveryMessage(mode, "GitHub took too long to respond.");
  }
  if (normalized.includes("status 429") || normalized.includes("rate limit")) {
    return syncRecoveryMessage(mode, "GitHub rate limits are active right now.");
  }
  if (
    normalized.includes("status 401") ||
    normalized.includes("status 403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("github authorization is missing") ||
    normalized.includes("github authorization is expired")
  ) {
    if (mode === "user") {
      return "Session authorization is missing or expired for this sync. Refresh session, ensure GitRank GitHub App is installed, then retry.";
    }
    return "Sync authorization failed. GitRank extracts PR data through GitHub App installation tokens. Refresh session or verify app installation, then retry.";
  }
  const appSyncFailureCode = deriveAppSyncFailureCodeFromApiError(message, code);
  if (appSyncFailureCode) {
    // Preserve account-action wording that references session identity.
    if (appSyncFailureCode === "user_sync_actor_mismatch") {
      return "Sync request user does not match your signed-in GitHub account. Reconnect GitHub and retry.";
    }
    return appSyncFailureMessage(appSyncFailureCode);
  }
  if (
    normalized.includes("not a supported version") ||
    normalized.includes("version is not supported")
  ) {
    return "GitHub API version is not supported by GitHub. Update backend GITHUB_API_VERSION and retry sync.";
  }
  if (normalized.includes("sync already in progress")) {
    return "A GitHub sync for this account is already running. Wait for it to finish, then refresh.";
  }
  if (status >= 500 || code === "dependency_unavailable") {
    return syncRecoveryMessage(mode, "Sync services are temporarily unavailable.");
  }
  return message;
}

function syncRecoveryMessage(
  mode: "user" | "repository" | "installation" | "pull_request" | "review" | "issue" | "commit",
  reason: string,
): string {
  if (mode === "repository") {
    return `${reason} Repository sync kept any available evidence. Retry soon or run full dashboard auto-sync.`;
  }
  if (mode === "installation") {
    return `${reason} Installation sync kept any available evidence. Retry after a short wait.`;
  }
  if (mode === "pull_request") {
    return `${reason} Pull-request sync kept any available evidence. Retry soon with the same owner/repo and PR number.`;
  }
  if (mode === "review") {
    return `${reason} Review sync kept any available evidence. Retry soon with the same owner/repo and review number.`;
  }
  if (mode === "issue") {
    return `${reason} Issue sync kept any available evidence. Retry soon with the same owner/repo and issue number.`;
  }
  if (mode === "commit") {
    return `${reason} Commit sync kept any available evidence. Retry soon with the same owner/repo and commit SHA.`;
  }
  return `${reason} User sync did not complete. Retry sync from Settings after a short delay.`;
}

function isGitHubSessionRecoveryFailure(status: number, code: string | undefined, message: string): boolean {
  if (status !== 401 && status !== 403) {
    return false;
  }
  const normalizedCode = (code ?? "").trim().toLowerCase();
  if (
    normalizedCode === "unauthorized" ||
    normalizedCode === "forbidden"
  ) {
    return true;
  }
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes("github authorization is missing") ||
    normalizedMessage.includes("github authorization is expired")
  );
}

async function tryRefreshSessionForUserSync(csrfToken: string): Promise<boolean> {
  try {
    const response = await fetch("/api/session/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function requireCSRFToken(): string {
  if (typeof document === "undefined") {
    throw new Error("CSRF token is only available in the browser.");
  }

  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${DEFAULT_CSRF_COOKIE_NAME}=`));
  if (!cookie) {
    throw new Error("CSRF cookie is missing.");
  }

  return decodeURIComponent(cookie.slice(DEFAULT_CSRF_COOKIE_NAME.length + 1));
}

function normalizeSyncExecutionContext(context?: SyncExecutionAuthContext): {
  user?: string;
  installation_id?: number;
} {
  const user = context?.user?.trim();
  const installationId = context?.installationId;
  const normalizedInstallationID =
    typeof installationId === "number" && Number.isFinite(installationId) && installationId > 0
      ? Math.trunc(installationId)
      : undefined;

  return {
    user: user || undefined,
    installation_id: normalizedInstallationID,
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  if (typeof AbortController === "undefined" || timeoutMs <= 0) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return error.name === "AbortError" || message.includes("timed out") || message.includes("aborted");
}

function isRetryableUserSyncTransportError(error: unknown): boolean {
  if (isAbortLikeError(error)) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const normalized = error.message.toLowerCase();
  if (error.name === "TypeError") {
    return true;
  }
  return normalized.includes("failed to fetch") || normalized.includes("networkerror");
}

function isRetryableUserSyncUpstreamFailure(status: number, code: string | undefined, message: string): boolean {
  if (USER_SYNC_RETRYABLE_STATUS_CODES.has(status)) {
    return true;
  }
  const normalizedCode = (code ?? "").trim().toLowerCase();
  if (
    normalizedCode === "upstream_timeout" ||
    normalizedCode === "github_rate_limited" ||
    normalizedCode === "dependency_unavailable"
  ) {
    return true;
  }
  const normalizedMessage = message.toLowerCase();
  if (
    normalizedMessage.includes("context deadline exceeded") ||
    normalizedMessage.includes("client.timeout exceeded") ||
    normalizedMessage.includes("rate limit")
  ) {
    return true;
  }
  return false;
}

function userSyncRetryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  const retryAfterDelay = parseRetryAfterMs(retryAfterHeader);
  if (retryAfterDelay !== null) {
    return clampRetryDelay(retryAfterDelay);
  }
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const backoff = USER_SYNC_RETRY_BASE_DELAY_MS * 2 ** (safeAttempt - 1);
  const jitter = USER_SYNC_RETRY_JITTER_MS > 0
    ? Math.floor(Math.random() * (USER_SYNC_RETRY_JITTER_MS + 1))
    : 0;
  return clampRetryDelay(backoff + jitter);
}

function clampRetryDelay(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return USER_SYNC_RETRY_BASE_DELAY_MS;
  }
  return Math.min(USER_SYNC_RETRY_MAX_DELAY_MS, Math.max(0, Math.floor(value)));
}

function parseRetryAfterMs(value?: string | null): number | null {
  const normalized = (value ?? "").trim();
  if (!normalized) {
    return null;
  }
  const seconds = Number.parseInt(normalized, 10);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000;
  }
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const delta = timestamp - Date.now();
  if (delta <= 0) {
    return 0;
  }
  return delta;
}

async function sleep(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, Math.floor(durationMs)));
  });
}

function parsePositiveMs(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoundedPositiveInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = parsePositiveInt(value, fallback);
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function parseBoundedPositiveMs(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = parsePositiveMs(value, fallback);
  if (parsed < min) {
    return min;
  }
  if (parsed > max) {
    return max;
  }
  return parsed;
}

function parseISOEpochMs(value: string | undefined): number | null {
  if (!value || !value.trim()) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function normalizeSyncRunFilterToken(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase();
}

function normalizeSyncRunFilterUser(value: string | undefined): string {
  const normalized = normalizeSyncRunFilterToken(value);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/^@+/, "");
}

function normalizeSyncRunFilterRepository(value: string | undefined): string {
  return normalizeSyncRunFilterToken(value);
}
