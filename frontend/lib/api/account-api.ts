const DEFAULT_CSRF_COOKIE_NAME =
  process.env.NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME ?? "gitrank_csrf";

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

export type QueueSyncInput = {
  mode:
    | "user"
    | "repository"
    | "pull_request"
    | "review"
    | "issue"
    | "commit";
  user?: string;
  repository?: string;
  number?: number;
  sha?: string;
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
      user: input.user,
      repository: input.repository,
      number: input.number,
      sha: input.sha,
    }),
  });
  return adaptJSON<ApiSyncResponse>(response, "Sync request failed.");
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
): Promise<ApiSyncExecutionResponse> {
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
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "Repository sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "repository"),
  });
}

export async function runUserSync(user?: string): Promise<ApiSyncExecutionResponse> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync/user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      user,
    }),
  });
  return adaptJSON<ApiSyncExecutionResponse>(response, "User sync failed.", {
    transformError: (message, status, code) =>
      sanitizeSyncExecutionError(message, status, code, "user"),
  });
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

function sanitizeSyncExecutionError(
  message: string,
  status: number,
  code: string | undefined,
  mode: "user" | "repository" | "installation",
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
    normalized.includes("forbidden")
  ) {
    return "GitHub authorization is blocked for this sync. Reconnect GitHub from Settings, then retry.";
  }
  if (status >= 500 || code === "dependency_unavailable") {
    return syncRecoveryMessage(mode, "Sync services are temporarily unavailable.");
  }
  return message;
}

function syncRecoveryMessage(
  mode: "user" | "repository" | "installation",
  reason: string,
): string {
  if (mode === "repository") {
    return `${reason} Repository sync kept any available evidence. Retry soon or run full dashboard auto-sync.`;
  }
  if (mode === "installation") {
    return `${reason} Installation sync kept any available evidence. Retry after a short wait.`;
  }
  return `${reason} User sync kept any available evidence and dashboard auto-sync will retry in the background.`;
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
