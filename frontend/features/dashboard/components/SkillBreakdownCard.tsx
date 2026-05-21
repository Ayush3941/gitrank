import { BarChart3 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import type { UserProfile } from "@/types/gitrank";
import type { SkillInsight } from "@/lib/ai/abra-insights-types";

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

  return (
    <GlowCard className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Skill breakdown</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Signal by lane</h2>
          <p className="mt-2 text-sm text-muted">
            {aiMode === "gemini"
              ? "Gemini interpretation is based on synced PR evidence."
              : "Deterministic interpretation is shown until Gemini is available."}
          </p>
        </div>
        <div className="neon-tile cyber-sheen rounded-3xl p-3 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>
      <SkillRadarChart skills={skillTree} />
      <div className="grid gap-3 md:grid-cols-2">
        {skillTree.map((skill, index) => {
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
    </GlowCard>
  );
}

function normalizeKey(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (normalized === "devops") return "infrastructure";
  return normalized;
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
