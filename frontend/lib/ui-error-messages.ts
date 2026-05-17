type UserFacingErrorContext =
  | "settings-account-actions"
  | "settings-privacy"
  | "onboarding-sync";

const CONTEXT_FALLBACK_MESSAGES: Record<UserFacingErrorContext, string> = {
  "settings-account-actions":
    "Account action failed for now. Retry in a moment or reconnect GitHub from Settings.",
  "settings-privacy":
    "Privacy update failed for now. Retry in a moment. Existing visibility settings remain unchanged.",
  "onboarding-sync":
    "Sync failed for now. Keep this page open and retry shortly while background refresh continues.",
};

const TECHNICAL_MARKERS = [
  "context deadline exceeded",
  "client.timeout exceeded",
  "dial tcp",
  "no such host",
  "connection refused",
  "i/o timeout",
  "status 500",
  "status 502",
  "status 503",
  "status 504",
  "internal server error",
  "json",
  "syntaxerror",
  "stack trace",
] as const;

const URL_PATTERN = /https?:\/\/\S+/i;

export function sanitizeUserFacingError(
  message: string | null | undefined,
  context: UserFacingErrorContext,
): string {
  const value = message?.trim() ?? "";
  if (!value) {
    return "";
  }

  const normalized = value.toLowerCase();

  if (
    normalized.includes("status 401") ||
    normalized.includes("status 403") ||
    normalized.includes("unauthorized") ||
    normalized.includes("forbidden") ||
    normalized.includes("bad credentials")
  ) {
    return "GitHub authorization is no longer valid. Reconnect GitHub from Settings and retry.";
  }

  if (normalized.includes("status 429") || normalized.includes("rate limit")) {
    return "GitHub rate limits are active right now. Wait briefly, then retry.";
  }

  if (
    normalized.includes("csrf") ||
    normalized.includes("cookie is missing") ||
    normalized.includes("invalid csrf")
  ) {
    return "Session protection expired. Refresh the page and sign in again before retrying.";
  }

  if (
    normalized.includes("context deadline exceeded") ||
    normalized.includes("client.timeout exceeded") ||
    normalized.includes("timeout")
  ) {
    return "GitHub did not respond in time. Wait about a minute, then retry.";
  }

  if (
    normalized.includes("status 500") ||
    normalized.includes("status 502") ||
    normalized.includes("status 503") ||
    normalized.includes("status 504") ||
    normalized.includes("internal server error") ||
    normalized.includes("temporarily unavailable")
  ) {
    return CONTEXT_FALLBACK_MESSAGES[context];
  }

  if (looksTechnical(value)) {
    return CONTEXT_FALLBACK_MESSAGES[context];
  }

  return value;
}

function looksTechnical(message: string): boolean {
  const normalized = message.toLowerCase();
  if (URL_PATTERN.test(message)) {
    return true;
  }
  return TECHNICAL_MARKERS.some((marker) => normalized.includes(marker));
}
