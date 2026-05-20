import { Lock } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { SignalIcon } from "@/components/shared/SignalIcon";
import { Progress } from "@/components/ui/progress";
import { BadgeDetailDialog } from "@/features/badges/components/BadgeDetailDialog";
import type { BadgeStory } from "@/lib/ai/abra-insights-types";
import { formatDate } from "@/lib/formatters";
import type { Badge } from "@/types/gitrank";

export function BadgeGrid({
  badges,
  stories,
}: {
  badges: Badge[];
  stories?: Record<string, BadgeStory>;
}) {
  return (
    <ul role="list" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => (
        <li key={badge.id} className="list-none">
          <BadgeDetailDialog badge={badge} story={stories?.[badge.id]}>
            <div
              role="button"
              tabIndex={0}
              className="focus-ring cursor-pointer text-left"
              aria-label={`Open ${badge.name} details`}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.currentTarget.click();
                }
              }}
            >
              <GlowCard className="render-opt-card cyber-hero-shell h-full space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-3xl bg-primary/12 p-3 text-primary">
                    <SignalIcon icon={badge.icon} className="h-5 w-5" />
                  </div>
                  <RarityBadge rarity={badge.rarity} />
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        badge.unlocked
                          ? "neon-chip neon-chip-success rounded-full px-3 py-1 font-semibold"
                          : "neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold"
                      }
                    >
                      {badge.unlocked ? "Unlocked" : "Locked"}
                    </span>
                    {!badge.unlocked ? (
                      <span className="neon-chip neon-chip-info rounded-full px-3 py-1 font-semibold">
                        Progress {badge.progress ?? 0}%
                      </span>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-semibold text-white">{badge.name}</h3>
                  <ExpandableText
                    text={badge.description}
                    lines={3}
                    minLengthForToggle={120}
                    className="mt-2"
                    textClassName="text-sm text-muted"
                    showMoreLabel="Read why"
                    showLessLabel="Hide why"
                  />
                  <p className="mt-2 text-xs font-medium text-primary">
                    {badge.unlocked ? "Unlock pattern" : "How to unlock"}
                  </p>
                  <ExpandableText
                    text={badge.unlockCondition}
                    lines={2}
                    minLengthForToggle={120}
                    className="mt-1"
                    textClassName="text-xs text-muted"
                    showMoreLabel="Read trigger"
                    showLessLabel="Hide trigger"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={badge.unlocked ? "text-emerald-200" : "text-muted"}>
                    {badge.unlocked ? `Earned ${formatDate(badge.earnedAt)}` : "Locked"}
                  </span>
                  {!badge.unlocked ? (
                    <span className="inline-flex items-center gap-1 text-muted">
                      <Lock className="h-3.5 w-3.5" />
                      {badge.progress ?? 0}%
                    </span>
                  ) : null}
                </div>
                {!badge.unlocked ? (
                  <div className="space-y-1">
                    <Progress value={badge.progress ?? 0} />
                    <p className="text-xs text-muted">
                      {badge.progress ?? 0}% toward unlock • {Math.max(0, 100 - (badge.progress ?? 0))}% remaining
                    </p>
                  </div>
                ) : null}
                {stories?.[badge.id] ? (
                  <div className="neon-surface rounded-xl border-fuchsia-300/24 px-3 py-2 text-xs text-muted">
                    <ExpandableText
                      text={stories[badge.id].story}
                      lines={4}
                      minLengthForToggle={180}
                      className="mt-2"
                      textClassName="text-muted"
                      showMoreLabel="Read story"
                      showLessLabel="Hide story"
                    />
                  </div>
                ) : null}
              </GlowCard>
            </div>
          </BadgeDetailDialog>
        </li>
      ))}
    </ul>
  );
}
