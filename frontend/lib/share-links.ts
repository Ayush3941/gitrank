export function toAbsoluteShareUrl(path: string, origin?: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!origin) {
    return normalizedPath;
  }
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  return `${normalizedOrigin}${normalizedPath}`;
}
