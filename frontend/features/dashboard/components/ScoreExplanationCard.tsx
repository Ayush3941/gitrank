import { Minus, Plus } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import type { UserProfile } from "@/types/gitrank";

export function ScoreExplanationCard({ user }: { user: UserProfile }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Why your score changed this week</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Transparent XP sources and penalties</h2>
      </div>
      <div className="space-y-3">
        {user.scoreChanges.map((change, index) => {
          const positive = change.type === "gain";
          const Icon = positive ? Plus : Minus;
          return (
            <div key={`${change.label}-${index}`} className="neon-surface flex items-start gap-4 rounded-[1.75rem] p-4">
              <div className={`rounded-2xl p-2 ${positive ? "bg-emerald-400/12 text-emerald-200" : "bg-rose-400/12 text-rose-100"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-white">{change.label}</p>
                  <p className={`text-sm font-semibold ${positive ? "text-emerald-200" : "text-rose-100"}`}>
                    {positive ? "+" : ""}
                    {change.deltaXp} XP
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">{change.reason}</p>
              </div>
            </div>
          );
        })}
      </div>
    </GlowCard>
  );
}
