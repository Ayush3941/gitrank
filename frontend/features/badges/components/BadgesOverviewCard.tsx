"use client";

import { type ReactNode } from "react";
import { Crown, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPercent, formatPluralCount } from "@/lib/formatters";
import {
  badgeUnlockRecoveryHref,
  badgeUnlockRecoveryLabel,
} from "@/lib/presentation/badge-unlock-route";
import type { Badge } from "@/types/gitrank";

export function BadgesOverviewCard({
  archetype,
  identitySummary,
  unlockedCount,
  completionPercent,
  level,
  streakDays,
  unlockNotice,
  nextUnlockTarget,
  onDismissUnlockNotice,
}: {
  archetype: string;
  identitySummary: string;
  unlockedCount: number;
  completionPercent: number;
  level: number;
  streakDays: number;
  unlockNotice: string;
  nextUnlockTarget: Badge | null;
  onDismissUnlockNotice: () => void;
}) {
  return (
    <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Progress overview</h2>
            <p className="mt-1 text-sm text-muted">{archetype} track</p>
            <ExpandableText
              text={identitySummary}
              lines={2}
              minLengthForToggle={170}
              className="mt-2 max-w-3xl"
              textClassName="text-sm text-muted"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <BadgeMetric
            label="Unlocked"
            value={formatNumber(unlockedCount)}
            icon={<ShieldCheck className="h-4 w-4 text-cyan-200" aria-hidden="true" />}
          />
          <BadgeMetric
            label="Completion"
            value={formatPercent(completionPercent)}
            icon={<Crown className="h-4 w-4 text-fuchsia-200" aria-hidden="true" />}
          />
          <BadgeMetric
            label="Level"
            value={formatNumber(level)}
            icon={<Trophy className="h-4 w-4 text-violet-200" aria-hidden="true" />}
          />
          <BadgeMetric
            label="Current streak"
            value={formatPluralCount(streakDays, "day")}
            icon={<Sparkles className="h-4 w-4 text-emerald-200" aria-hidden="true" />}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-cyan-200">Badge progress</p>
          <Progress value={completionPercent} aria-label="Overall badge completion progress" />
        </div>
        <InlineNotice
          message={unlockNotice}
          placeholder="Badge update"
          variant="success"
          minHeightClassName="min-h-7"
          onDismiss={onDismissUnlockNotice}
          dismissLabel="Dismiss badge update"
        />
        {nextUnlockTarget ? (
          <div className="neon-surface space-y-3 border border-primary/22 px-4 py-4">
            <p className="text-xs font-medium text-primary">Closest next unlock</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">{nextUnlockTarget.name}</p>
                <p className="mt-1 text-sm text-muted">
                  {formatPercent(nextUnlockTarget.progress ?? 0)} complete, {nextUnlockTarget.rarity}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <IntentPrefetchLink href={badgeUnlockRecoveryHref(nextUnlockTarget.unlockCondition)}>
                  {badgeUnlockRecoveryLabel(nextUnlockTarget.unlockCondition)}
                </IntentPrefetchLink>
              </Button>
            </div>
            <ExpandableText
              text={nextUnlockTarget.unlockCondition}
              lines={3}
              minLengthForToggle={140}
              textClassName="text-sm text-muted"
              showMoreLabel="Read unlock path"
              showLessLabel="Hide unlock path"
            />
          </div>
        ) : null}
      </div>
    </GlowCard>
  );
}

function BadgeMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        {value}
        <span aria-hidden="true">{icon}</span>
      </p>
    </div>
  );
}
