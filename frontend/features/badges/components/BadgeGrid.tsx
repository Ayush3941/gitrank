import { Lock } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { SignalIcon } from "@/components/shared/SignalIcon";
import { BadgeDetailDialog } from "@/features/badges/components/BadgeDetailDialog";
import type { Badge } from "@/types/gitrank";

export function BadgeGrid({ badges }: { badges: Badge[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {badges.map((badge) => (
        <BadgeDetailDialog key={badge.id} badge={badge}>
          <button className="focus-ring text-left">
            <GlowCard className="h-full space-y-4 transition hover:-translate-y-0.5 hover:bg-white/8">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-3xl bg-primary/12 p-3 text-primary">
                  <SignalIcon icon={badge.icon} className="h-5 w-5" />
                </div>
                <RarityBadge rarity={badge.rarity} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{badge.name}</h2>
                <p className="mt-2 text-sm text-muted">{badge.unlockCondition}</p>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={badge.unlocked ? "text-emerald-200" : "text-muted"}>
                  {badge.unlocked ? `Earned ${badge.earnedAt}` : "Locked"}
                </span>
                {!badge.unlocked ? (
                  <span className="inline-flex items-center gap-1 text-muted">
                    <Lock className="h-3.5 w-3.5" />
                    {badge.progress ?? 0}%
                  </span>
                ) : null}
              </div>
            </GlowCard>
          </button>
        </BadgeDetailDialog>
      ))}
    </div>
  );
}
