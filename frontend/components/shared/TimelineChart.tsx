"use client";

import dynamic from "next/dynamic";
import { useId } from "react";
import { useLazyInView } from "@/hooks/use-lazy-in-view";
import {
  useNetworkConstraintPreference,
  useReducedGamification,
} from "@/hooks/use-gamification-preference";

const TimelineChartInner = dynamic(
  () => import("@/components/shared/timeline-chart-inner").then((mod) => mod.TimelineChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full gap-2 p-3">
        <div className="neon-skeleton h-6 w-1/2 rounded-lg" />
        <div className="neon-skeleton h-full rounded-2xl" />
      </div>
    ),
  },
);

export function TimelineChart({ data }: { data: Array<{ label: string; xp: number }> }) {
  const summaryId = useId();
  const { ref: viewportRef, inView } = useLazyInView();
  const constrainedNetwork = useNetworkConstraintPreference();
  const reducedGamification = useReducedGamification();
  const useLiteRenderer = constrainedNetwork || reducedGamification;
  const safeData = data.length > 0 ? data : [{ label: "No data", xp: 0 }];
  const firstPoint = safeData[0];
  const lastPoint = safeData[safeData.length - 1];
  const growth = lastPoint.xp - firstPoint.xp;
  const topPoint = safeData.reduce((best, point) => (point.xp > best.xp ? point : best), safeData[0]);
  const previousPoint = safeData.length > 1 ? safeData[safeData.length - 2] : null;
  const latestDelta = previousPoint ? lastPoint.xp - previousPoint.xp : 0;
  const recentWindow = safeData.slice(-8);
  const momentumLabel = latestDelta > 0 ? "Rising" : latestDelta < 0 ? "Cooling" : "Flat";
  const momentumToneClass =
    latestDelta > 0
      ? "neon-chip neon-chip-success"
      : latestDelta < 0
        ? "neon-chip neon-chip-warning"
        : "neon-chip neon-chip-muted";

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="neon-tile relative h-72 w-full overflow-hidden rounded-[1.75rem] p-3"
        role="img"
        aria-describedby={summaryId}
      >
        {useLiteRenderer ? (
          <TimelineChartLite data={safeData} />
        ) : inView ? (
          <TimelineChartInner data={safeData} />
        ) : (
          <TimelineChartFallback />
        )}
        <p className="sr-only">Contribution quality timeline showing cumulative XP growth over time.</p>
      </div>
      <div className="neon-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-primary">Timeline summary</p>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${momentumToneClass}`}>
            Momentum {momentumLabel}
          </span>
        </div>
        <p id={summaryId} className="mt-2 text-sm text-muted">
          Start {firstPoint.label}: {firstPoint.xp} XP. Latest {lastPoint.label}: {lastPoint.xp} XP.
          {" "}Net change: {growth >= 0 ? "+" : ""}{growth} XP.
        </p>
        <p className="mt-1 text-sm text-muted">
          Peak month: {topPoint.label} ({topPoint.xp} XP).
          {previousPoint ? ` Latest step: ${formatSignedXP(latestDelta)} XP.` : ""}
        </p>
        <ul role="list" className="mt-3 space-y-1 text-xs text-muted">
          {recentWindow.map((point, index) => (
            <li key={`${point.label}-${index}`} className="flex items-center justify-between gap-3">
              <span>{point.label}</span>
              <span>{point.xp} XP</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function formatSignedXP(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }
  return `${value}`;
}

function TimelineChartFallback() {
  return (
    <div className="grid h-full w-full gap-2 p-3">
      <div className="neon-skeleton h-6 w-1/2 rounded-lg" />
      <div className="neon-skeleton h-full rounded-2xl" />
    </div>
  );
}

function TimelineChartLite({ data }: { data: Array<{ label: string; xp: number }> }) {
  const maxXP = Math.max(1, ...data.map((point) => point.xp));
  const compactWindow = data.slice(-8);

  return (
    <div className="neon-surface h-full space-y-3 px-4 py-4">
      <p className="text-xs font-semibold text-primary">Lite timeline view</p>
      <div className="space-y-2">
        {compactWindow.map((point, index) => {
          const fill = Math.max(0, Math.min(100, Math.round((point.xp / maxXP) * 100)));
          return (
            <div key={`${point.label}-${index}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{point.label}</span>
                <span>{point.xp} XP</span>
              </div>
              <div className="neon-track h-2.5 overflow-hidden border border-primary/22 bg-primary/8">
                <div className="h-full bg-gradient-to-r from-primary/80 to-primary-2/75" style={{ width: `${fill}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
