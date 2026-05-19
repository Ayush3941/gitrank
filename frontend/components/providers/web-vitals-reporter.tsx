"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useCallback, useEffect, useRef } from "react";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import {
  normalizeWebVitalRating,
  routeGroupFromPathname,
  shouldSampleWebVital,
  WEB_VITAL_TRACKED_METRICS,
} from "@/lib/web-vitals";

type WebVitalMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

const MAX_DEDUP_KEYS = 512;
const DEDUP_TRIM_TARGET = 256;

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
    if (!WEB_VITAL_TRACKED_METRICS.has(metric.name) || !Number.isFinite(metric.value)) {
      return;
    }

    const activeRouteGroup = routeGroupRef.current;
    const metricKey = `${activeRouteGroup}:${metric.name}:${metric.id}`;
    if (sentMetricKeysRef.current.has(metricKey)) {
      return;
    }
    const configuredSampleRate = Number(process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE);
    if (!shouldSampleWebVital(metric.name, metric.id, activeRouteGroup, configuredSampleRate)) {
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

    const rating = normalizeWebVitalRating(metric.rating);
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
