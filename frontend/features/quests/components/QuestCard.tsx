import { Flag, Gift, Link2 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/types/gitrank";

export function QuestCard({ quest }: { quest: Quest }) {
  const progress = Math.round((quest.progress / quest.goal) * 100);
  const statusTone =
    quest.status === "Completed"
      ? "neon-chip neon-chip-success"
      : quest.status === "Locked"
        ? "neon-chip neon-chip-warning"
        : "neon-chip neon-chip-info";

  return (
    <GlowCard className="relative space-y-4 overflow-hidden border border-cyan-300/20 bg-gradient-to-br from-slate-950/88 via-slate-900/82 to-cyan-950/30">
      <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-cyan-400/12 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
            <Flag className="h-3.5 w-3.5 text-primary" />
            {quest.cadence}
          </div>
          <h2 className="text-xl font-semibold text-white">{quest.title}</h2>
          <p className="text-sm text-muted">{quest.description}</p>
          <p className="text-sm leading-6 text-slate-200/76">{quest.whyRecommended}</p>
        </div>
        <div className="neon-chip neon-chip-info rounded-3xl px-3 py-2 text-sm font-medium">
          +{quest.rewardXp} XP
        </div>
      </div>
      <Progress value={progress} />
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{quest.progress} / {quest.goal}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone}`}>{quest.status}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {quest.evidenceSignals.map((signal) => (
          <span key={signal} className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
            {signal}
          </span>
        ))}
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs">
          <Link2 className="h-3 w-3" />
          {quest.linkedContributionIds.length} evidence PRs
        </span>
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
