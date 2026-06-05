export function copyHeaderIfPresent(headers: Headers, key: string, value: string | null) {
  if (!value || value.trim().length === 0) {
    return;
  }
  headers.set(key, value);
}

export function readSetCookieHeaders(headers: Headers): string[] {
  const cookieHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof cookieHeaders.getSetCookie === "function") {
    return cookieHeaders.getSetCookie();
  }

  const fallback = headers.get("set-cookie");
  return fallback ? [fallback] : [];
}

export function readOriginWithFallback(envKeys: readonly string[], fallback: string): string {
  const raw = readFirstNonEmptyEnv(envKeys) || fallback;
  try {
    return new URL(raw).origin;
  } catch {
    throw new Error(`${envKeys.join(" or ")} must be a valid absolute URL`);
  }
}

function readFirstNonEmptyEnv(envKeys: readonly string[]): string {
  for (const envKey of envKeys) {
    const value = process.env[envKey]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}
