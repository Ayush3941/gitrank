"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { SignalIcon } from "@/components/shared/SignalIcon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { BadgeStory } from "@/lib/ai/abra-insights-types";
import { formatDate } from "@/lib/formatters";
import type { Badge } from "@/types/gitrank";

export function BadgeDetailDialog({
  badge,
  story,
  children,
}: {
  badge: Badge;
  story?: BadgeStory;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <div className="space-y-5">
          <DialogDescription className="sr-only">
            Badge detail panel with unlock condition, progress, and qualifying evidence links.
          </DialogDescription>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="neon-tile cyber-sheen inline-flex rounded-[var(--radius-universal)] p-3 text-primary">
                <SignalIcon icon={badge.icon} className="h-5 w-5" />
              </div>
              <DialogTitle className="text-2xl font-semibold text-white">{badge.name}</DialogTitle>
              <div>
                <ExpandableText
                  text={badge.description}
                  lines={4}
                  minLengthForToggle={160}
                  textClassName="text-sm text-muted"
                  showMoreLabel="Read description"
                  showLessLabel="Hide description"
                />
              </div>
            </div>
            <RarityBadge rarity={badge.rarity} />
          </div>
          <GlowCard className="cyber-sheen space-y-3 neon-surface p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={badge.unlocked ? "neon-chip neon-chip-success rounded-full px-3 py-1 font-semibold" : "neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold"}>
                {badge.unlocked ? "Unlocked" : "Locked"}
              </span>
              {badge.unlocked ? (
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                  Earned {formatDate(badge.earnedAt)}
                </span>
              ) : null}
            </div>
            <p className="text-xs font-medium text-primary">Unlock condition</p>
            <ExpandableText
              text={badge.unlockCondition}
              lines={4}
              minLengthForToggle={140}
              textClassName="text-sm text-muted"
              showMoreLabel="Read condition"
              showLessLabel="Hide condition"
            />
            {typeof badge.rarityScore === "number" ? (
              <p className="text-sm text-muted">
                Rarity index {badge.rarityScore}/100 from the current badge rules.
              </p>
            ) : null}
            {typeof badge.progress === "number" ? (
              <div className="space-y-2">
                <Progress value={badge.progress} />
                <p className="text-sm text-primary">{badge.progress}% progress</p>
              </div>
            ) : null}
          </GlowCard>
          {story ? (
            <GlowCard className="cyber-sheen space-y-3 neon-surface border-fuchsia-300/24 p-4">
              <p className="text-xs font-medium text-fuchsia-200">Achievement story</p>
              <ExpandableText
                text={story.story}
                lines={5}
                minLengthForToggle={220}
                textClassName="text-sm text-muted"
                showMoreLabel="Read full story"
                showLessLabel="Hide full story"
              />
              <div className="space-y-2 text-sm text-muted">
                <p>
                  <span className="text-cyan-200">Trigger:</span>
                </p>
                <ExpandableText
                  text={story.trigger}
                  lines={3}
                  minLengthForToggle={130}
                  textClassName="text-sm text-muted"
                  showMoreLabel="Expand trigger"
                  showLessLabel="Collapse trigger"
                />
              </div>
              <div className="space-y-2 text-sm text-muted">
                <p>
                  <span className="text-cyan-200">Next:</span>
                </p>
                <ExpandableText
                  text={story.nextFocus}
                  lines={3}
                  minLengthForToggle={130}
                  textClassName="text-sm text-muted"
                  showMoreLabel="Expand next"
                  showLessLabel="Collapse next"
                />
              </div>
            </GlowCard>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs font-medium text-primary">Evidence PRs</p>
            <div className="flex flex-wrap gap-2">
              {badge.evidencePrIds.length ? (
                badge.evidencePrIds.map((prId, index) => (
                  <span key={`${badge.id}-${prId}-${index}`} className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 text-sm">
                    {prId}
                  </span>
                ))
              ) : (
                <div className="space-y-2">
                  <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 text-sm">
                    No qualifying PRs yet
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/dashboard/contributions" prefetch={false}>Open contributions</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/dashboard/quests" prefetch={false}>Open quests</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
