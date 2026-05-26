export function publicBaseURL(): string {
  const candidate = process.env.GITRANK_PUBLIC_BASE_URL?.trim() || "http://localhost:3000";

  try {
    return new URL(candidate).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function absolutePublicURL(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, publicBaseURL()).toString();
}
