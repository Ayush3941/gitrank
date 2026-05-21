import Link from "next/link";
import { Link2, Target } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { Quest } from "@/types/gitrank";

export function QuestPanel({ quests }: { quests: Quest[] }) {
  return (
    <GlowCard className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Active quests</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Next XP lane</h2>
        </div>
        <div className="neon-surface rounded-3xl p-3 text-primary">
          <Target className="h-5 w-5" />
        </div>
      </div>
      <div className="space-y-3">
        {quests.length === 0 ? (
          <div className="neon-surface space-y-3 rounded-[1.75rem] border-dashed p-4 text-sm text-muted">
            <p>
              No quests in this snapshot yet. Sync once to generate mission cards from scored PR evidence.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/contributions" prefetch={false}>Open contributions</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/dashboard/settings" prefetch={false}>Open sync settings</Link>
              </Button>
            </div>
          </div>
        ) : null}
        <ol role="list" className="space-y-3">
          {quests.slice(0, 3).map((quest) => {
            const progress = safeQuestProgress(quest.progress, quest.goal);
            return (
              <li key={quest.id} className="list-none">
                <article className="render-opt-card neon-surface rounded-[1.75rem] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-medium text-white">{quest.title}</h3>
                      <ExpandableText
                        text={quest.description}
                        lines={2}
                        minLengthForToggle={140}
                        className="mt-1"
                        textClassName="text-sm leading-6 text-muted"
                      />
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
                  <ul role="list" className="mt-3 flex flex-wrap gap-2">
                    {quest.evidenceSignals.slice(0, 3).map((signal, index) => (
                      <li key={`${quest.id}-${signal}-${index}`}>
                        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                          {signal}
                        </span>
                      </li>
                    ))}
                    <li>
                      <span className="neon-chip neon-chip-muted inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs">
                        <Link2 className="h-3 w-3" />
                        {quest.linkedContributionIds.length} linked PRs
                      </span>
                    </li>
                  </ul>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </GlowCard>
  );
}

function safeQuestProgress(progress: number, goal: number): number {
  const safeGoal = goal > 0 ? goal : 1;
  const ratio = (progress / safeGoal) * 100;
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(ratio)));
}
