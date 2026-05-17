"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

type WebVitalMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

const trackedMetrics = new Set(["CLS", "FCP", "LCP", "INP", "TTFB", "FID"]);

export function WebVitalsReporter() {
  const pathname = usePathname();
  const routeGroup = routeGroupFromPathname(pathname);
  const routeGroupRef = useRef(routeGroup);

  useEffect(() => {
    routeGroupRef.current = routeGroup;
  }, [routeGroup]);

  const reportMetric = useCallback((metric: WebVitalMetric) => {
    if (!trackedMetrics.has(metric.name) || !Number.isFinite(metric.value)) {
      return;
    }

    const rating = normalizeRating(metric.rating);
    const activeRouteGroup = routeGroupRef.current;
    void emitAnalyticsEvent({
      eventName: "web_vital.sample",
      source: "frontend",
      target: `${activeRouteGroup}:${metric.name.toLowerCase()}`,
      status: "success",
      metricName: metric.name,
      metricValue: Number(metric.value.toFixed(4)),
      metricRating: rating,
      routeGroup: activeRouteGroup,
    });
  }, []);

  useReportWebVitals(reportMetric);

  return null;
}

function routeGroupFromPathname(pathname: string | null): string {
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
  return "other";
}

function normalizeRating(value: string | undefined): "good" | "needs-improvement" | "poor" | "unknown" {
  switch (value) {
    case "good":
    case "needs-improvement":
    case "poor":
      return value;
    default:
      return "unknown";
  }
}
