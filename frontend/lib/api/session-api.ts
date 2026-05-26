import { frontendPolicy } from "@/lib/runtime/frontend-policy";

const DEFAULT_CSRF_COOKIE_NAME = frontendPolicy.csrfCookieName;

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export type SessionIdentity = {
  subject: string;
  display_name?: string;
  avatar_url?: string;
  github_login?: string;
  github_authorization_status: string;
  roles?: string[];
  session_expires_at: string;
  session_idle_expires_at: string;
  session_rotated_at: string;
  linked_account: {
    github_user_id: number;
    login: string;
    display_name?: string;
    email?: string;
    avatar_url?: string;
    user_type?: string;
    access_mode?: string;
    scope?: string;
    linked_at: string;
    unlinked_at?: string;
    status: string;
  };
};

export type SessionEnvelope = {
  session: SessionIdentity;
  csrf_header: string;
  csrf_hint: string;
};

export async function getSessionEnvelope(): Promise<SessionEnvelope> {
  const response = await fetch("/api/session/me", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Session inspection failed."));
  }
  return (await response.json()) as SessionEnvelope;
}

export async function refreshSession(): Promise<SessionEnvelope> {
  const csrfToken = requireCSRFToken();
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
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, "Session refresh failed."));
  }
  return (await response.json()) as SessionEnvelope;
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
