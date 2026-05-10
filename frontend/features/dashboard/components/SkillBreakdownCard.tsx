import { BarChart3 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import type { UserProfile } from "@/types/gitrank";

export function SkillBreakdownCard({ user }: { user: UserProfile }) {
  return (
    <GlowCard className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Skill breakdown</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Reputation signal by discipline</h2>
        </div>
        <div className="rounded-3xl bg-white/6 p-3 text-primary">
          <BarChart3 className="h-5 w-5" />
        </div>
      </div>
      <SkillRadarChart skills={user.skillTree} />
    </GlowCard>
  );
}
