import { Link2, Target } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import type { Quest } from "@/types/gitrank";

export function QuestPanel({ quests }: { quests: Quest[] }) {
  return (
    <GlowCard className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Active quests</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Weak lanes become your next ladder.</h2>
        </div>
        <div className="rounded-3xl bg-white/6 p-3 text-primary">
          <Target className="h-5 w-5" />
        </div>
      </div>
      <div className="space-y-3">
        {quests.length === 0 ? (
          <div className="rounded-[1.75rem] border border-dashed border-white/12 bg-white/4 p-4 text-sm text-muted">
            No live quests are available for this profile snapshot yet. Run a sync or wait for new scored evidence to refresh the quest board.
          </div>
        ) : null}
        {quests.slice(0, 3).map((quest) => {
          const progress = Math.round((quest.progress / quest.goal) * 100);
          return (
            <div key={quest.id} className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-medium text-white">{quest.title}</p>
                  <p className="text-sm text-muted">{quest.description}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200/72">{quest.whyRecommended}</p>
                </div>
                <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm text-primary">
                  +{quest.rewardXp} XP
                </div>
              </div>
              <Progress className="mt-4" value={progress} />
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{quest.progress} / {quest.goal}</span>
                <span>{quest.weakAreaTarget ? `Targets ${quest.weakAreaTarget}` : quest.cadence}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {quest.evidenceSignals.slice(0, 3).map((signal) => (
                  <span key={signal} className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    {signal}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-muted">
                  <Link2 className="h-3 w-3" />
                  {quest.linkedContributionIds.length} linked PRs
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlowCard>
  );
}
