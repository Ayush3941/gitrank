import { Flag, Gift, Link2 } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/types/gitrank";

export function QuestCard({ quest }: { quest: Quest }) {
  const goal = quest.goal > 0 ? quest.goal : 1;
  const progress = Math.max(
    0,
    Math.min(100, Math.round((quest.progress / goal) * 100)),
  );
  const statusTone =
    quest.status === "Completed"
      ? "neon-chip neon-chip-success"
      : quest.status === "Locked"
        ? "neon-chip neon-chip-warning"
        : "neon-chip neon-chip-info";

  return (
    <GlowCard className="render-opt-card cyber-hero-shell relative space-y-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-[0.1] [background:repeating-linear-gradient(170deg,rgba(255,255,255,0.13)_0px,rgba(255,255,255,0.13)_1px,transparent_1px,transparent_11px)]" />
      <div className="pointer-events-none absolute -top-16 right-0 h-32 w-32 rounded-full bg-cyan-400/12 blur-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
            <Flag className="h-3.5 w-3.5 text-primary" />
            {quest.cadence}
          </div>
          <h2 className="break-anywhere text-xl font-semibold text-white">{quest.title}</h2>
          <ExpandableText
            text={quest.description}
            lines={3}
            minLengthForToggle={150}
            textClassName="break-anywhere text-sm text-muted"
          />
          <ExpandableText
            text={quest.whyRecommended}
            lines={3}
            minLengthForToggle={170}
            textClassName="break-anywhere text-sm leading-6 text-slate-200/76"
          />
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
        <div className="neon-chip neon-chip-warning inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-amber-100">
          <Gift className="h-3.5 w-3.5" />
          Rewards badge: {quest.rewardBadgeId}
        </div>
      ) : null}
    </GlowCard>
  );
}
