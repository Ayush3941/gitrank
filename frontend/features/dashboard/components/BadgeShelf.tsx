import { Lock } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import type { UserProfile } from "@/types/gitrank";

export function BadgeShelf({ user }: { user: UserProfile }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.24em] text-primary uppercase">Badge shelf</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Unlocked proof and visible next targets</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {user.badges.slice(0, 6).map((badge) => (
          <div key={badge.id} className="neon-surface rounded-[1.75rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <RarityBadge rarity={badge.rarity} />
              {!badge.unlocked ? (
                <div className="inline-flex items-center gap-1 text-xs text-muted">
                  <Lock className="h-3.5 w-3.5" />
                  Locked
                </div>
              ) : null}
            </div>
            <h3 className="mt-3 text-lg font-medium text-white">{badge.name}</h3>
            <p className="mt-2 text-sm text-muted">{badge.unlockCondition}</p>
            {!badge.unlocked && typeof badge.progress === "number" ? (
              <p className="mt-3 text-sm text-primary">{badge.progress}% progress</p>
            ) : null}
          </div>
        ))}
      </div>
    </GlowCard>
  );
}
