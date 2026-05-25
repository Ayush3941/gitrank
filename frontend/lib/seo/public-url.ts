export function publicBaseURL(): string {
  const candidate = process.env.GITRANK_PUBLIC_BASE_URL?.trim();
  if (!candidate) {
    throw new Error("GITRANK_PUBLIC_BASE_URL is required");
  }

  try {
    return new URL(candidate).origin;
  } catch {
    throw new Error("GITRANK_PUBLIC_BASE_URL must be a valid absolute URL");
  }
}

export function absolutePublicURL(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, publicBaseURL()).toString();
}
