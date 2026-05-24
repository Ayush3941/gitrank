import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import type { UserProfile } from "@/types/gitrank";
import type { SkillInsight } from "@/lib/ai/abra-insights-types";
import { normalizeSkillCategory } from "@/lib/presentation/skill-normalization";

export function SkillBreakdownCard({
  user,
  skillInsights,
  aiMode,
}: {
  user: UserProfile;
  skillInsights?: Record<string, SkillInsight>;
  aiMode?: "gemini" | "deterministic";
}) {
  const skillTree = deduplicateSkillTree(user.skillTree);
  const rankedSkills = [...skillTree].sort((left, right) => right.score - left.score);
  const visibleSkills = rankedSkills.slice(0, 4);
  const hiddenSkillCount = Math.max(0, rankedSkills.length - visibleSkills.length);

  return (
    <GlowCard className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Skill breakdown</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Signal by skill</h2>
          <p className="mt-2 text-sm text-muted">
            {aiMode === "gemini"
              ? "Gemini summary from synced PR evidence."
              : "Deterministic summary until Gemini is available."}
          </p>
        </div>
        <div className="neon-tile cyber-sheen rounded-3xl p-3 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>
      <SkillRadarChart skills={skillTree} />
      <div className="grid gap-3 md:grid-cols-2">
        {visibleSkills.map((skill, index) => {
          const insight = skillInsights?.[normalizeKey(skill.category)];
          const confidence = insight?.confidence ?? "emerging";
          return (
            <div key={`${skill.category}-${index}`} className="render-opt-card neon-surface space-y-2 rounded-[1.5rem] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{skill.category}</p>
                <span className="neon-chip neon-chip-muted rounded-full px-2.5 py-1 text-xs font-semibold">
                  {confidence}
                </span>
              </div>
              <p className="text-xs text-muted">
                {insight?.summary || skill.note}
              </p>
              {insight?.evidence ? <p className="text-xs text-muted">Evidence: {insight.evidence}</p> : null}
            </div>
          );
        })}
      </div>
      {hiddenSkillCount > 0 ? (
        <div className="neon-surface flex flex-wrap items-center justify-between gap-3 border border-primary/20 px-4 py-3">
          <p className="text-sm text-muted">
            {hiddenSkillCount} additional skill lanes are available.
          </p>
          <Link
            href={`/u/${user.username}`}
            prefetch={false}
            className="focus-ring dashboard-nav-item inline-flex min-h-9 items-center justify-center px-3 py-1.5 text-xs font-medium"
          >
            Open full profile map
          </Link>
        </div>
      ) : null}
    </GlowCard>
  );
}

function normalizeKey(value: string): string {
  return normalizeSkillCategory(value);
}

function deduplicateSkillTree(skills: UserProfile["skillTree"]): UserProfile["skillTree"] {
  const ordered: UserProfile["skillTree"] = [];
  const indexByCategory = new Map<string, number>();

  for (const skill of skills) {
    const key = normalizeKey(skill.category);
    const existingIndex = indexByCategory.get(key);
    if (existingIndex === undefined) {
      indexByCategory.set(key, ordered.length);
      ordered.push(skill);
      continue;
    }
    const existing = ordered[existingIndex];
    if (skill.score > existing.score) {
      ordered[existingIndex] = {
        ...existing,
        ...skill,
      };
    }
  }

  return ordered;
}
