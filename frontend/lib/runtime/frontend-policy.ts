function readRequiredString(envKey: string): string {
  const value = process.env[envKey]?.trim();
  if (!value) {
    throw new Error(`${envKey} is required`);
  }
  return value;
}

export const frontendPolicy = {
  csrfCookieName: readRequiredString("NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME"),
  scoreVersionFallback: readRequiredString("NEXT_PUBLIC_GITRANK_SCORE_VERSION_FALLBACK"),
} as const;
