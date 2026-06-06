"use client";

import { ExpandableText } from "@/components/shared/ExpandableText";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/formatters";
import {
  badgeUnlockRecoveryHref,
  badgeUnlockRecoveryLabel,
} from "@/lib/presentation/badge-unlock-route";
import type { Badge } from "@/types/gitrank";

export function BadgesLockedPathsSection({
  lockedBadges,
  lockedBadgePreview,
  visibleLockedBadges,
  hasMoreLockedBadges,
  remainingLockedBadges,
  showLockedBadges,
  isLoading,
  isError,
  regionId,
  toggleId,
  onToggleLockedBadges,
  onShowMoreLockedBadges,
}: {
  lockedBadges: Badge[];
  lockedBadgePreview: Badge[];
  visibleLockedBadges: Badge[];
  hasMoreLockedBadges: boolean;
  remainingLockedBadges: number;
  showLockedBadges: boolean;
  isLoading: boolean;
  isError: boolean;
  regionId: string;
  toggleId: string;
  onToggleLockedBadges: () => void;
  onShowMoreLockedBadges: () => void;
}) {
  return (
    <section
      id="badges-locked"
      data-scroll-target="true"
      className="render-opt-section space-y-3"
    >
      {!isLoading && !isError ? (
        <>
          <div className="neon-surface flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-universal)] px-4 py-3">
            <h2 className="text-sm font-semibold text-white">
              Locked paths ({lockedBadges.length})
            </h2>
            <DisclosureToggle
              id={toggleId}
              controlsId={regionId}
              expanded={showLockedBadges}
              onToggle={onToggleLockedBadges}
              collapsedLabel="Show details"
              expandedLabel="Hide details"
            />
          </div>

          {!showLockedBadges ? (
            <LockedPathPreview badges={lockedBadgePreview} />
          ) : null}

          <div
            id={regionId}
            role="region"
            aria-labelledby={toggleId}
            hidden={!showLockedBadges}
            className="neon-surface rounded-[var(--radius-universal)] border border-fuchsia-300/24 p-3"
          >
            {lockedBadges.length > 0 ? (
              <>
                <ul role="list" className="grid gap-3 md:grid-cols-3">
                  {visibleLockedBadges.map((badge) => (
                    <LockedPathCard key={badge.id} badge={badge} />
                  ))}
                </ul>
                {hasMoreLockedBadges ? (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted">
                      {remainingLockedBadges} locked paths remaining
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={onShowMoreLockedBadges}
                    >
                      Show more locked paths
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <LockedPathEmptyState />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function LockedPathPreview({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) {
    return <LockedPathEmptyState />;
  }

  return (
    <div className="neon-surface rounded-[var(--radius-universal)] border border-fuchsia-300/18 px-4 py-4">
      <p className="text-xs font-medium text-fuchsia-200">Upcoming unlock queue</p>
      <ul role="list" className="mt-3 grid gap-2 md:grid-cols-3">
        {badges.map((badge) => (
          <li
            key={`${badge.id}-preview`}
            className="list-none rounded-[var(--radius-universal)] border border-fuchsia-300/20 bg-fuchsia-400/6 px-3 py-2"
          >
            <p className="text-sm font-semibold text-white">{badge.name}</p>
            <p className="mt-1 text-xs text-muted">{badge.rarity}</p>
            <p className="mt-1 text-xs text-cyan-100">
              {formatPercent(badge.progress ?? 0)} complete
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Expand to view full unlock conditions and path links.
      </p>
    </div>
  );
}

function LockedPathCard({ badge }: { badge: Badge }) {
  return (
    <li className="render-opt-card neon-surface rounded-[var(--radius-universal)] border-dashed border-fuchsia-300/32 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium text-fuchsia-200">{badge.rarity}</p>
        <span className="neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold">
          {formatPercent(badge.progress ?? 0)} complete
        </span>
      </div>
      <h3 className="mt-2 text-base font-semibold text-white">{badge.name}</h3>
      <ExpandableText
        text={badge.unlockCondition}
        lines={3}
        minLengthForToggle={120}
        className="mt-2"
        textClassName="text-sm text-muted"
        showMoreLabel="Expand condition"
        showLessLabel="Collapse condition"
      />
      <div className="mt-3 space-y-1">
        <Progress value={badge.progress ?? 0} aria-label={`${badge.name} badge progress`} />
        <p className="text-xs text-muted">
          {formatPercent(badge.progress ?? 0)} verified progress {"\u00b7"}{" "}
          {formatPercent(100 - (badge.progress ?? 0))} remaining
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-cyan-100">
          Next move: {badgeUnlockRecoveryLabel(badge.unlockCondition)}
        </p>
        <Button asChild variant="ghost" size="sm">
          <IntentPrefetchLink href={badgeUnlockRecoveryHref(badge.unlockCondition)}>
            Open path
          </IntentPrefetchLink>
        </Button>
      </div>
    </li>
  );
}

function LockedPathEmptyState() {
  return (
    <div className="neon-surface rounded-[var(--radius-universal)] border-dashed border-fuchsia-300/32 px-4 py-4 text-sm text-muted">
      No locked badge definitions are returned by this snapshot.
    </div>
  );
}
