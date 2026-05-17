"use client";

import dynamic from "next/dynamic";
import type { SkillNode } from "@/types/gitrank";

const SkillRadarChartInner = dynamic(
  () =>
    import("@/components/shared/skill-radar-chart-inner").then(
      (mod) => mod.SkillRadarChartInner,
    ),
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

export function SkillRadarChart({ skills }: { skills: SkillNode[] }) {
  return (
    <div className="neon-tile relative h-80 w-full overflow-hidden rounded-[1.75rem] p-3">
      <div className="pointer-events-none absolute -top-12 right-8 h-28 w-28 rounded-full bg-fuchsia-400/16 blur-3xl" />
      <SkillRadarChartInner skills={skills} />
      <p className="sr-only">
        Skill radar chart showing the most evident contribution signals across documentation, testing, backend, and architecture.
      </p>
    </div>
  );
}
