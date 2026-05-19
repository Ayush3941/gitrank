export const WEB_VITAL_TRACKED_METRICS = new Set(["CLS", "FCP", "LCP", "INP", "TTFB", "FID"]);

export const DEFAULT_WEB_VITAL_SAMPLE_RATE = 0.35;

export function routeGroupFromPathname(pathname: string | null): string {
  const value = (pathname || "/").toLowerCase();
  if (value === "/") return "marketing.home";
  if (value.startsWith("/login")) return "auth.login";
  if (value.startsWith("/oauth")) return "auth.oauth";
  if (value.startsWith("/onboarding/connect-github")) return "onboarding.connect";
  if (value.startsWith("/onboarding/analyzing")) return "onboarding.analyzing";
  if (value.startsWith("/onboarding/reveal")) return "onboarding.reveal";
  if (value.startsWith("/dashboard/contributions")) return "dashboard.contributions";
  if (value.startsWith("/dashboard/badges")) return "dashboard.badges";
  if (value.startsWith("/dashboard/quests")) return "dashboard.quests";
  if (value.startsWith("/dashboard/settings")) return "dashboard.settings";
  if (value.startsWith("/dashboard/leaderboard")) return "dashboard.leaderboard";
  if (value.startsWith("/dashboard")) return "dashboard.overview";
  if (value.startsWith("/u/")) return "public.profile";
  if (value.startsWith("/pr/")) return "public.pr_report";
  if (value.startsWith("/onboarding")) return "onboarding.other";

  const segments = value.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "other.root";
  }
  return `other.${segments[0]}`;
}

export function normalizeWebVitalRating(value: string | undefined): "good" | "needs-improvement" | "poor" | "unknown" {
  switch (value) {
    case "good":
    case "needs-improvement":
    case "poor":
      return value;
    default:
      return "unknown";
  }
}

export function shouldSampleWebVital(
  metricName: string,
  metricID: string,
  routeGroup: string,
  configuredRate: number | undefined,
): boolean {
  const sampleRate = Number.isFinite(configuredRate)
    ? clamp(configuredRate as number, 0, 1)
    : DEFAULT_WEB_VITAL_SAMPLE_RATE;
  if (sampleRate >= 1) {
    return true;
  }
  if (sampleRate <= 0) {
    return false;
  }
  const bucket = hashToUnitInterval(`${routeGroup}:${metricName}:${metricID}`);
  return bucket < sampleRate;
}

function hashToUnitInterval(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const normalized = (hash >>> 0) / 4294967295;
  return clamp(normalized, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
