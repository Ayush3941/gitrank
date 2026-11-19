export const frontendPolicy = {
  csrfCookieName: process.env.NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME?.trim() || "gitrank_csrf",
  scoreVersionFallback: "v1alpha1",
} as const;
