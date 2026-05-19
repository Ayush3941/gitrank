"use client";

import dynamic from "next/dynamic";
import { useId } from "react";
import { useLazyInView } from "@/hooks/use-lazy-in-view";
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
  const summaryId = useId();
  const { ref: viewportRef, inView } = useLazyInView();
  const safeSkills = skills.length > 0
    ? skills
    : [{ category: "Documentation", score: 0, delta: 0, note: "No skill evidence available yet." }];
  const sortedSkills = [...safeSkills].sort((left, right) => right.score - left.score);
  const strongest = sortedSkills[0];
  const weakest = sortedSkills[sortedSkills.length - 1];

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="neon-tile relative h-80 w-full overflow-hidden rounded-[1.75rem] p-3"
        role="img"
        aria-describedby={summaryId}
      >
        {inView ? <SkillRadarChartInner skills={safeSkills} /> : <SkillRadarChartFallback />}
        <p className="sr-only">
          Skill radar chart showing the most evident contribution signals across documentation, testing, backend, and architecture.
        </p>
      </div>
      <details className="neon-surface px-4 py-3">
        <summary className="focus-ring inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-primary">
          Skill signal summary
        </summary>
        <p id={summaryId} className="mt-2 text-sm text-slate-200/86">
          Strongest current lane: {strongest.category} ({strongest.score}).
          {" "}Lowest lane: {weakest.category} ({weakest.score}).
        </p>
        <ul role="list" className="mt-3 space-y-1 text-xs text-slate-200/84">
          {sortedSkills.map((skill) => (
            <li key={skill.category} className="flex items-center justify-between gap-3">
              <span>{skill.category}</span>
              <span>{skill.score}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function SkillRadarChartFallback() {
  return (
    <div className="grid h-full w-full gap-2 p-3">
      <div className="neon-skeleton h-6 w-1/2 rounded-lg" />
      <div className="neon-skeleton h-full rounded-2xl" />
    </div>
  );
}
