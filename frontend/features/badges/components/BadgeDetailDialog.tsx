"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
              <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
                <SignalIcon icon={badge.icon} className="h-5 w-5" />
              </div>
              <DialogTitle className="text-2xl font-semibold text-white">{badge.name}</DialogTitle>
              <DialogDescription className="text-sm text-muted">{badge.description}</DialogDescription>
            </div>
            <RarityBadge rarity={badge.rarity} />
          </div>
          <GlowCard className="space-y-3 neon-surface p-4">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Unlock condition</p>
            <p className="text-sm text-slate-200">{badge.unlockCondition}</p>
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
            <GlowCard className="space-y-3 neon-surface border-fuchsia-300/24 p-4">
              <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">Achievement story</p>
              <p className="text-sm text-slate-200/88">{story.story}</p>
              <p className="text-sm text-slate-200/84">
                <span className="text-cyan-200">Trigger:</span> {story.trigger}
              </p>
              <p className="text-sm text-slate-200/84">
                <span className="text-cyan-200">Next:</span> {story.nextFocus}
              </p>
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
