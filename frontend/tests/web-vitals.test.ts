import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEB_VITAL_SAMPLE_RATE,
  normalizeWebVitalRating,
  routeGroupFromPathname,
  shouldSampleWebVital,
  WEB_VITAL_TRACKED_METRICS,
} from "@/lib/web-vitals";

describe("routeGroupFromPathname", () => {
  it("maps known dashboard and public routes", () => {
    expect(routeGroupFromPathname("/dashboard")).toBe("dashboard.overview");
    expect(routeGroupFromPathname("/dashboard/contributions")).toBe("dashboard.contributions");
    expect(routeGroupFromPathname("/u/octocat")).toBe("public.profile");
    expect(routeGroupFromPathname("/pr/openai/gpt/42")).toBe("public.pr_report");
  });

  it("maps unknown paths into stable fallback buckets", () => {
    expect(routeGroupFromPathname("/foo/bar")).toBe("other.foo");
    expect(routeGroupFromPathname("/")).toBe("marketing.home");
    expect(routeGroupFromPathname(null)).toBe("marketing.home");
  });
});

describe("normalizeWebVitalRating", () => {
  it("keeps supported ratings and normalizes unknown values", () => {
    expect(normalizeWebVitalRating("good")).toBe("good");
    expect(normalizeWebVitalRating("needs-improvement")).toBe("needs-improvement");
    expect(normalizeWebVitalRating("poor")).toBe("poor");
    expect(normalizeWebVitalRating("unexpected")).toBe("unknown");
    expect(normalizeWebVitalRating(undefined)).toBe("unknown");
  });
});

describe("shouldSampleWebVital", () => {
  it("always samples at rate 1 and never samples at rate 0", () => {
    expect(shouldSampleWebVital("LCP", "metric-1", "dashboard.overview", 1)).toBe(true);
    expect(shouldSampleWebVital("LCP", "metric-1", "dashboard.overview", 0)).toBe(false);
  });

  it("clamps out-of-range rates", () => {
    expect(shouldSampleWebVital("INP", "metric-2", "dashboard.overview", 99)).toBe(true);
    expect(shouldSampleWebVital("INP", "metric-2", "dashboard.overview", -5)).toBe(false);
  });

  it("falls back to the default sampling rate when value is invalid", () => {
    const first = shouldSampleWebVital("CLS", "metric-3", "dashboard.badges", Number.NaN);
    const second = shouldSampleWebVital("CLS", "metric-3", "dashboard.badges", Number.NaN);
    expect(first).toBe(second);
    expect(typeof first).toBe("boolean");
  });
});

describe("WEB_VITAL_TRACKED_METRICS", () => {
  it("contains current core/web vital metric names expected by reporter", () => {
    expect(WEB_VITAL_TRACKED_METRICS.has("CLS")).toBe(true);
    expect(WEB_VITAL_TRACKED_METRICS.has("LCP")).toBe(true);
    expect(WEB_VITAL_TRACKED_METRICS.has("INP")).toBe(true);
    expect(WEB_VITAL_TRACKED_METRICS.has("FID")).toBe(true);
    expect(DEFAULT_WEB_VITAL_SAMPLE_RATE).toBeGreaterThan(0);
    expect(DEFAULT_WEB_VITAL_SAMPLE_RATE).toBeLessThan(1);
  });
});
