"use client";

import dynamic from "next/dynamic";

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
  return (
    <div className="neon-tile relative h-72 w-full overflow-hidden rounded-[1.75rem] p-3">
      <div className="pointer-events-none absolute -left-10 top-14 h-24 w-24 rounded-full bg-cyan-400/14 blur-3xl" />
      <TimelineChartInner data={data} />
      <p className="sr-only">Contribution quality timeline showing cumulative XP growth over time.</p>
    </div>
  );
}
