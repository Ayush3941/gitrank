"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { SignalIcon } from "@/components/shared/SignalIcon";
import type { Badge } from "@/types/gitrank";

export function BadgeDetailDialog({
  badge,
  children,
}: {
  badge: Badge;
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
          <GlowCard className="space-y-3 border border-white/8 bg-white/5 p-4">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Unlock condition</p>
            <p className="text-sm text-slate-200">{badge.unlockCondition}</p>
            {typeof badge.progress === "number" ? (
              <p className="text-sm text-primary">{badge.progress}% progress</p>
            ) : null}
          </GlowCard>
          <div className="space-y-2">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Evidence PRs</p>
            <div className="flex flex-wrap gap-2">
              {badge.evidencePrIds.length ? (
                badge.evidencePrIds.map((prId) => (
                  <span key={prId} className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                    {prId}
                  </span>
                ))
              ) : (
                <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-muted">
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
