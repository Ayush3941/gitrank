import Link from "next/link";
import { Lock } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import type { UserProfile } from "@/types/gitrank";

export function BadgeShelf({ user }: { user: UserProfile }) {
  const visibleBadges = deduplicateBadgesByName(user.badges);
  const unlockedCount = visibleBadges.filter((badge) => badge.unlocked).length;
  const totalCount = visibleBadges.length;
  const completion =
    totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Badge shelf</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Unlocked badges</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{unlockedCount} / {totalCount} unlocked</span>
            <span>{completion}%</span>
          </div>
          <Progress value={completion} />
        </div>
      </div>
      <ul role="list" className="grid gap-3 md:grid-cols-2">
        {visibleBadges.length === 0 ? (
          <li className="list-none neon-surface space-y-3 rounded-[1.75rem] border-dashed p-4 text-sm text-muted md:col-span-2">
            <p>
              No badges in this snapshot yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/badges" prefetch={false}>Open badge forge</Link>
              </Button>
            </div>
          </li>
        ) : null}
        {visibleBadges.slice(0, 6).map((badge, index) => (
          <li key={`${badge.id}-${index}`} className="list-none render-opt-card neon-surface rounded-[1.75rem] p-4">
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
            <ExpandableText
              text={badge.unlockCondition}
              lines={2}
              minLengthForToggle={120}
              className="mt-2"
              textClassName="text-sm text-muted"
            />
            {!badge.unlocked && typeof badge.progress === "number" ? (
              <div className="mt-3 space-y-1">
                <Progress value={badge.progress} />
                <p className="text-sm text-primary">{badge.progress}% progress</p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </GlowCard>
  );
}
