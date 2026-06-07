"use client";

import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RarityBadge } from "@/components/shared/RarityBadge";
import type { Badge } from "@/types/gitrank";

export function PublicProfileBadgesCard({ badges }: { badges: Badge[] }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Badges</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Top badges</h2>
      </div>
      {badges.length > 0 ? (
        <ul role="list" className="grid gap-3 sm:grid-cols-2">
          {badges.slice(0, 3).map((badge) => (
            <li
              key={badge.id}
              className="render-opt-card neon-surface rounded-[var(--radius-universal)] p-4"
            >
              <RarityBadge rarity={badge.rarity} />
              <h3 className="mt-3 text-lg font-medium text-white">{badge.name}</h3>
              <ExpandableText
                text={badge.description}
                lines={3}
                minLengthForToggle={120}
                className="mt-2"
                textClassName="text-sm text-muted"
                showMoreLabel="More"
                showLessLabel="Less"
              />
            </li>
          ))}
        </ul>
      ) : (
        <CompactEmptyState
          title="No badge unlocks yet"
          description="Badge unlocks appear here as scored contributions land."
          primaryAction={{
            label: "Open quests",
            href: "/dashboard/quests",
            prefetchMode: "never",
          }}
        />
      )}
    </GlowCard>
  );
}
