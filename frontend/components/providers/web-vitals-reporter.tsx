"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

type WebVitalMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

const trackedMetrics = new Set(["CLS", "FCP", "LCP", "INP", "TTFB", "FID"]);
const MAX_DEDUP_KEYS = 512;
const DEDUP_TRIM_TARGET = 256;
const DEFAULT_WEB_VITAL_SAMPLE_RATE = 0.35;

export function WebVitalsReporter() {
  const pathname = usePathname();
  const routeGroup = routeGroupFromPathname(pathname);
  const routeGroupRef = useRef(routeGroup);
  const sentMetricKeysRef = useRef(new Set<string>());
  const sentMetricQueueRef = useRef<string[]>([]);

  useEffect(() => {
    routeGroupRef.current = routeGroup;
  }, [routeGroup]);

  const reportMetric = useCallback((metric: WebVitalMetric) => {
    if (!trackedMetrics.has(metric.name) || !Number.isFinite(metric.value)) {
      return;
    }

    const activeRouteGroup = routeGroupRef.current;
    const metricKey = `${activeRouteGroup}:${metric.name}:${metric.id}`;
    if (sentMetricKeysRef.current.has(metricKey)) {
      return;
    }
    if (!shouldSampleWebVital(metric, activeRouteGroup)) {
      return;
    }
    sentMetricKeysRef.current.add(metricKey);
    sentMetricQueueRef.current.push(metricKey);
    if (sentMetricQueueRef.current.length > MAX_DEDUP_KEYS) {
      while (sentMetricQueueRef.current.length > DEDUP_TRIM_TARGET) {
        const staleKey = sentMetricQueueRef.current.shift();
        if (staleKey) {
          sentMetricKeysRef.current.delete(staleKey);
        }
      }
    }

    const rating = normalizeRating(metric.rating);
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
  if (value.startsWith("/onboarding")) return "onboarding.other";

  const segments = value.split("/").filter(Boolean);
  if (segments.length === 0) {
    return "other.root";
  }
  return `other.${segments[0]}`;
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

function shouldSampleWebVital(metric: WebVitalMetric, routeGroup: string): boolean {
  const configuredRate = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE);
  const sampleRate = Number.isFinite(configuredRate)
    ? clamp(configuredRate, 0, 1)
    : DEFAULT_WEB_VITAL_SAMPLE_RATE;
  if (sampleRate >= 1) {
    return true;
  }
  if (sampleRate <= 0) {
    return false;
  }
  const bucket = hashToUnitInterval(`${routeGroup}:${metric.name}:${metric.id}`);
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
