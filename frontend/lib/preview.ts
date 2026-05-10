import type { PreviewMode } from "@/types/gitrank";

const allowed = new Set<PreviewMode>(["default", "loading", "error", "empty", "stale"]);

export function getPreviewMode(value?: string): PreviewMode | undefined {
  if (!value) return undefined;
  return allowed.has(value as PreviewMode) ? (value as PreviewMode) : undefined;
}
