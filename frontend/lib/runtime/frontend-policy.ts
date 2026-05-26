function readString(envKey: string, fallback: string): string {
  const value = process.env[envKey]?.trim();
  return value || fallback;
}

export const frontendPolicy = {
  csrfCookieName: readString("NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME", "gitrank_csrf"),
  scoreVersionFallback: readString("NEXT_PUBLIC_GITRANK_SCORE_VERSION_FALLBACK", "v1alpha1"),
} as const;
