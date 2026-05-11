import type { PreviewMode } from "@/types/gitrank";

const allowed = new Set<PreviewMode>(["default", "loading", "error", "empty", "stale"]);

type PreviewEnv = {
  GITRANK_ENABLE_DEMO_PREVIEWS?: string;
  NEXT_PUBLIC_GITRANK_ENABLE_DEMO_PREVIEWS?: string;
  NODE_ENV?: string;
};

export function getPreviewMode(value?: string): PreviewMode | undefined {
  if (!areDemoPreviewsEnabled()) return undefined;
  if (!value) return undefined;
  return allowed.has(value as PreviewMode) ? (value as PreviewMode) : undefined;
}

export function areDemoPreviewsEnabled(env: PreviewEnv = process.env): boolean {
  const explicit = flagValue(
    env.GITRANK_ENABLE_DEMO_PREVIEWS ?? env.NEXT_PUBLIC_GITRANK_ENABLE_DEMO_PREVIEWS,
  );
  if (explicit !== undefined) {
    return explicit;
  }
  return env.NODE_ENV !== "production";
}

function flagValue(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    case "0":
    case "false":
    case "no":
    case "off":
      return false;
    default:
      return undefined;
  }
}
