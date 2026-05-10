import { Flag, Gift } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/types/gitrank";

export function QuestCard({ quest }: { quest: Quest }) {
  const progress = Math.round((quest.progress / quest.goal) * 100);

  return (
    <GlowCard className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-muted">
            <Flag className="h-3.5 w-3.5 text-primary" />
            {quest.cadence}
          </div>
          <h2 className="text-xl font-semibold text-white">{quest.title}</h2>
          <p className="text-sm text-muted">{quest.description}</p>
        </div>
        <div className="rounded-3xl bg-primary/12 px-3 py-2 text-sm font-medium text-primary">
          +{quest.rewardXp} XP
        </div>
      </div>
      <Progress value={progress} />
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{quest.progress} / {quest.goal}</span>
        <span>{quest.status}</span>
      </div>
      {quest.rewardBadgeId ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-sm text-amber-100">
          <Gift className="h-3.5 w-3.5" />
          Rewards badge: {quest.rewardBadgeId}
        </div>
      ) : null}
    </GlowCard>
  );
}
