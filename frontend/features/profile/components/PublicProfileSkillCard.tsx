"use client";

import dynamic from "next/dynamic";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { formatNumber, toRatioPercent } from "@/lib/formatters";
import type { SkillNode } from "@/types/gitrank";

const SkillRadarChart = dynamic(
  () =>
    import("@/components/shared/SkillRadarChart").then(
      (mod) => mod.SkillRadarChart,
    ),
  {
    loading: () => <PublicProfileSkillPlaceholder />,
  },
);

const EMPTY_SKILL_TITLE = "Skill map needs scored evidence";
const EMPTY_SKILL_DESCRIPTION =
  "Skill signals appear after a scored profile snapshot includes visible PR evidence.";

export function PublicProfileSkillCard({
  skills,
  constrainedNetwork,
}: {
  skills: SkillNode[];
  constrainedNetwork: boolean;
}) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Skills</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Skill map</h2>
        <p className="mt-1 text-sm text-muted">
          Live view of what your visible PR history signals right now.
        </p>
      </div>
      {skills.length === 0 ? (
        <CompactEmptyState
          title={EMPTY_SKILL_TITLE}
          description={EMPTY_SKILL_DESCRIPTION}
          primaryAction={{
            label: "Open contributions",
            href: "/dashboard/contributions",
            prefetchMode: "never",
          }}
        />
      ) : constrainedNetwork ? (
        <PublicProfileLiteSkillSummary skills={skills} />
      ) : (
        <DeferUntilVisible fallback={<PublicProfileSkillPlaceholder />}>
          <SkillRadarChart skills={skills} />
        </DeferUntilVisible>
      )}
    </GlowCard>
  );
}

function PublicProfileLiteSkillSummary({ skills }: { skills: SkillNode[] }) {
  if (skills.length === 0) {
    return (
      <CompactEmptyState
        title={EMPTY_SKILL_TITLE}
        description={EMPTY_SKILL_DESCRIPTION}
      />
    );
  }

  const topSkills = [...skills]
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
  const strongest = topSkills[0];
  const maxScore = topSkills.reduce((max, skill) => Math.max(max, skill.score), 0) || 1;

  return (
    <div className="space-y-3">
      {strongest ? (
        <div className="neon-surface border border-primary/22 px-4 py-3">
          <p className="text-xs font-medium text-primary">Strongest lane</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {strongest.category}
          </p>
          <p className="mt-1 text-xs text-muted">
            Signal {formatNumber(strongest.score)}
          </p>
        </div>
      ) : null}
      <ul role="list" className="space-y-3">
        {topSkills.map((skill) => {
          const width = Math.max(8, toRatioPercent(skill.score / maxScore));
          return (
            <li
              key={`${skill.category}-${skill.score}-${skill.delta}`}
              className="neon-surface rounded-[var(--radius-universal)] px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{skill.category}</p>
                <p className="text-xs text-muted">{formatNumber(skill.score)}</p>
              </div>
              <div className="mt-2 h-2 rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PublicProfileSkillPlaceholder() {
  return (
    <PanelLoadingPlaceholder
      label="Loading skill map"
      minHeightClassName="min-h-[16rem]"
      skeletons={[
        { className: "h-10 w-2/5" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
