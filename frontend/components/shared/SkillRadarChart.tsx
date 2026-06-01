"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { useLazyInView } from "@/hooks/use-lazy-in-view";
import { ScrollableRegion } from "@/components/shared/ScrollableRegion";
import {
  useNetworkConstraintPreference,
  useReducedGamification,
} from "@/hooks/use-gamification-preference";
import { deduplicateSkillNodes } from "@/lib/presentation/skill-normalization";
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
  const tableRegionId = useId();
  const tableToggleId = useId();
  const { ref: viewportRef, inView } = useLazyInView();
  const constrainedNetwork = useNetworkConstraintPreference();
  const reducedGamification = useReducedGamification();
  const useLiteRenderer = constrainedNetwork || reducedGamification;
  const [showDataTable, setShowDataTable] = useState(false);
  const safeSkills: SkillNode[] = skills.length > 0
    ? skills
    : [{ category: "Documentation", score: 0, delta: 0, note: "No skill evidence available yet." }];
  const deduplicatedSkills = deduplicateSkillNodes(safeSkills);
  const sortedSkills = [...deduplicatedSkills].sort((left, right) => right.score - left.score);
  const strongest = sortedSkills[0];
  const weakest = sortedSkills[sortedSkills.length - 1];

  return (
    <div className="space-y-3">
      <div
        ref={viewportRef}
        className="neon-tile relative h-80 w-full overflow-hidden rounded-[1.75rem] p-3"
        role="img"
        aria-label={`Skill radar chart across ${sortedSkills.length} lanes.`}
        aria-describedby={summaryId}
      >
        {useLiteRenderer ? (
          <SkillRadarLite skills={sortedSkills} />
        ) : inView ? (
          <SkillRadarChartInner skills={deduplicatedSkills} />
        ) : (
          <SkillRadarChartFallback />
        )}
        <p className="sr-only">
          Skill radar chart showing the most evident contribution signals across documentation, testing, backend, and architecture.
        </p>
      </div>
      <div className="neon-surface px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-primary">Skill signal summary</p>
          <button
            type="button"
            id={tableToggleId}
            className="focus-ring neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold"
            onClick={() => {
              setShowDataTable((current) => !current);
            }}
            aria-expanded={showDataTable}
            aria-controls={tableRegionId}
          >
            {showDataTable ? "Hide data table" : "View data table"}
          </button>
        </div>
        <p id={summaryId} className="mt-2 text-sm text-muted">
          Strongest signal: {strongest.category} ({strongest.score}).
          {" "}Lowest signal: {weakest.category} ({weakest.score}).
        </p>
        <ul role="list" className="mt-3 space-y-1 text-xs text-muted">
          {sortedSkills.map((skill) => (
            <li key={skillRowKey(skill)} className="flex items-center justify-between gap-3">
              <span>{skill.category}</span>
              <span>{skill.score}</span>
            </li>
          ))}
        </ul>
        {showDataTable ? (
          <ScrollableRegion
            id={tableRegionId}
            labelledById={tableToggleId}
            className="mt-3 overflow-x-auto"
          >
            <table className="w-full min-w-[24rem] text-left text-xs text-muted">
              <caption className="sr-only">Skill lane scores and delta values.</caption>
              <thead>
                <tr className="border-b border-primary/18 text-primary">
                  <th scope="col" className="px-2 py-2 font-semibold">Skill lane</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Score</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Delta</th>
                </tr>
              </thead>
              <tbody>
                {sortedSkills.map((skill) => (
                  <tr key={skillRowKey(skill)} className="border-b border-white/6 last:border-b-0">
                    <th scope="row" className="px-2 py-2 font-medium text-white">{skill.category}</th>
                    <td className="px-2 py-2">{skill.score}</td>
                    <td className="px-2 py-2">{skill.delta >= 0 ? "+" : ""}{skill.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollableRegion>
        ) : null}
      </div>
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

function SkillRadarLite({ skills }: { skills: SkillNode[] }) {
  const maxScore = Math.max(1, ...skills.map((skill) => skill.score));
  return (
    <div className="neon-surface h-full space-y-3 px-4 py-4">
      <div className="space-y-2">
        {skills.map((skill) => {
          const fill = Math.max(0, Math.min(100, Math.round((skill.score / maxScore) * 100)));
          return (
            <div key={skillRowKey(skill)} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{skill.category}</span>
                <span>{skill.score}</span>
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

function skillRowKey(skill: SkillNode): string {
  return `${skill.category}-${skill.score}-${skill.delta}`;
}
