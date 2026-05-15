import { Flag, Gift, Link2 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/types/gitrank";

export function QuestCard({ quest }: { quest: Quest }) {
  const progress = Math.round((quest.progress / quest.goal) * 100);
  const statusTone =
    quest.status === "Completed"
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : quest.status === "Locked"
        ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
        : "border-cyan-300/30 bg-cyan-400/10 text-cyan-100";

  return (
    <GlowCard className="relative space-y-4 overflow-hidden border border-cyan-300/20 bg-gradient-to-br from-slate-950/88 via-slate-900/82 to-cyan-950/30">
      <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-cyan-400/12 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-muted">
            <Flag className="h-3.5 w-3.5 text-primary" />
            {quest.cadence}
          </div>
          <h2 className="text-xl font-semibold text-white">{quest.title}</h2>
          <p className="text-sm text-muted">{quest.description}</p>
          <p className="text-sm leading-6 text-slate-200/76">{quest.whyRecommended}</p>
        </div>
        <div className="rounded-3xl bg-primary/12 px-3 py-2 text-sm font-medium text-primary">
          +{quest.rewardXp} XP
        </div>
      </div>
      <Progress value={progress} />
      <div className="flex items-center justify-between text-sm text-muted">
        <span>{quest.progress} / {quest.goal}</span>
        <span className={`rounded-full border px-2.5 py-1 text-xs ${statusTone}`}>{quest.status}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {quest.evidenceSignals.map((signal) => (
          <span key={signal} className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {signal}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-muted">
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
