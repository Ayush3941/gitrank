"use client";

import dynamic from "next/dynamic";
import { useId } from "react";

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
  const safeData = data.length > 0 ? data : [{ label: "No data", xp: 0 }];
  const firstPoint = safeData[0];
  const lastPoint = safeData[safeData.length - 1];
  const growth = lastPoint.xp - firstPoint.xp;
  const topPoint = safeData.reduce((best, point) => (point.xp > best.xp ? point : best), safeData[0]);

  return (
    <div className="space-y-3">
      <div
        className="neon-tile relative h-72 w-full overflow-hidden rounded-[1.75rem] p-3"
        role="img"
        aria-describedby={summaryId}
      >
        <TimelineChartInner data={safeData} />
        <p className="sr-only">Contribution quality timeline showing cumulative XP growth over time.</p>
      </div>
      <details className="neon-surface px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Timeline summary
        </summary>
        <p id={summaryId} className="mt-2 text-sm text-slate-200/86">
          Start {firstPoint.label}: {firstPoint.xp} XP. Latest {lastPoint.label}: {lastPoint.xp} XP.
          {" "}Net change: {growth >= 0 ? "+" : ""}{growth} XP.
        </p>
        <p className="mt-1 text-sm text-slate-200/86">
          Peak month: {topPoint.label} ({topPoint.xp} XP).
        </p>
        <ul role="list" className="mt-3 space-y-1 text-xs text-slate-200/84">
          {safeData.map((point) => (
            <li key={point.label} className="flex items-center justify-between gap-3">
              <span>{point.label}</span>
              <span>{point.xp} XP</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
