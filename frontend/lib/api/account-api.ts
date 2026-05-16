const DEFAULT_CSRF_COOKIE_NAME =
  process.env.NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME ?? "gitrank_csrf";

type ApiErrorResponse = {
  error?: {
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
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ mode: "user" }),
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
  return adaptJSON<ApiSyncExecutionResponse>(response, "Repository sync failed.");
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
  return adaptJSON<ApiSyncExecutionResponse>(response, "Installation sync failed.");
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

async function adaptJSON<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, fallback));
  }
  return (await response.json()) as T;
}

async function responseErrorMessage(response: Response, fallback: string): Promise<string> {
  const defaultMessage = `${fallback} Status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || defaultMessage;
  } catch {
    return defaultMessage;
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
