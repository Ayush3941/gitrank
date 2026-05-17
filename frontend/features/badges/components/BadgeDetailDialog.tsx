"use client";

import type { ReactNode } from "react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { SignalIcon } from "@/components/shared/SignalIcon";
import type { BadgeStory } from "@/lib/ai/abra-insights-types";
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
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="neon-tile cyber-sheen inline-flex rounded-3xl p-3 text-primary">
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
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Unlock condition</p>
            <ExpandableText
              text={badge.unlockCondition}
              lines={4}
              minLengthForToggle={140}
              textClassName="text-sm text-slate-200"
              showMoreLabel="Read condition"
              showLessLabel="Hide condition"
            />
            {typeof badge.rarityScore === "number" ? (
              <p className="text-sm text-muted">
                Rarity index {badge.rarityScore}/100 from the current badge rules.
              </p>
            ) : null}
            {typeof badge.progress === "number" ? (
              <p className="text-sm text-primary">{badge.progress}% progress</p>
            ) : null}
          </GlowCard>
          {story ? (
            <GlowCard className="cyber-sheen space-y-3 neon-surface border-fuchsia-300/24 p-4">
              <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">Achievement story</p>
              <ExpandableText
                text={story.story}
                lines={5}
                minLengthForToggle={220}
                textClassName="text-sm text-slate-200/88"
                showMoreLabel="Read full story"
                showLessLabel="Hide full story"
              />
              <div className="space-y-2 text-sm text-slate-200/84">
                <p>
                  <span className="text-cyan-200">Trigger:</span>
                </p>
                <ExpandableText
                  text={story.trigger}
                  lines={3}
                  minLengthForToggle={130}
                  textClassName="text-sm text-slate-200/84"
                  showMoreLabel="Expand trigger"
                  showLessLabel="Collapse trigger"
                />
              </div>
              <div className="space-y-2 text-sm text-slate-200/84">
                <p>
                  <span className="text-cyan-200">Next:</span>
                </p>
                <ExpandableText
                  text={story.nextFocus}
                  lines={3}
                  minLengthForToggle={130}
                  textClassName="text-sm text-slate-200/84"
                  showMoreLabel="Expand next"
                  showLessLabel="Collapse next"
                />
              </div>
            </GlowCard>
          ) : null}
          <div className="space-y-2">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Evidence PRs</p>
            <div className="flex flex-wrap gap-2">
              {badge.evidencePrIds.length ? (
                badge.evidencePrIds.map((prId) => (
                  <span key={prId} className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 text-sm">
                    {prId}
                  </span>
                ))
              ) : (
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 text-sm">
                  No qualifying PRs yet
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
