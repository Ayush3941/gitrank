const fallbackBaseURL = "http://localhost:3000";

export function publicBaseURL(): string {
  const candidate = process.env.GITRANK_PUBLIC_BASE_URL?.trim();
  if (!candidate) {
    return fallbackBaseURL;
  }

  try {
    return new URL(candidate).origin;
  } catch {
    return fallbackBaseURL;
  }
}

export function absolutePublicURL(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, publicBaseURL()).toString();
}
