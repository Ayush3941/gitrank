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
