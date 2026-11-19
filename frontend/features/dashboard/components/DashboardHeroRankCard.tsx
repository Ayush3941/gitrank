import { ArrowRight, Star } from "lucide-react";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { ContributionPulseStrip } from "@/components/shared/ContributionPulseStrip";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { ProfileAvatar } from "@/components/shared/ProfileAvatar";
import { RankBadge } from "@/components/shared/RankBadge";
import { XPProgress } from "@/components/shared/XPProgress";
import { Button } from "@/components/ui/button";
import { uniqueDisplayValues } from "@/lib/display-values";
import type { AbraInsightSource } from "@/lib/ai/abra-insights-types";
import { formatNumber, formatXp, formatXpLabel } from "@/lib/formatters";
import { formatAIInsightSourceLabel } from "@/lib/presentation/ai-insight-source";
import type { UserProfile } from "@/types/gitrank";

export function DashboardHeroRankCard({
  user,
  archetype,
  identitySummary,
  aiMode,
}: {
  user: UserProfile;
  archetype?: string;
  identitySummary?: string;
  aiMode?: AbraInsightSource;
}) {
  const aiSourceLabel = formatAIInsightSourceLabel(aiMode);
  const strongestSignals = uniqueDisplayValues(user.strongestSignals, 4);

  return (
    <GlowCard strong className="player-card-shell cyber-hero-shell space-y-6 overflow-hidden">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ProfileAvatar src={user.avatarUrl} displayName={user.displayName} priority />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="break-anywhere text-2xl font-semibold text-white">{user.displayName}</p>
              <RankBadge rank={user.level.rankTier} />
            </div>
            <p className="text-sm text-muted">@{user.username}</p>
            <p className="break-anywhere text-sm text-muted">
              {user.title}
              {archetype ? ` • ${archetype}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <IntentPrefetchLink href={`/u/${user.username}`}>
              Public profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </IntentPrefetchLink>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="neon-metric rounded-[var(--radius-universal)] p-5">
          <p className="text-xs font-medium text-primary">Level</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <span className="numeric-readout">{formatNumber(user.level.currentLevel)}</span>
          </p>
        </div>
        <div className="neon-metric rounded-[var(--radius-universal)] p-5">
          <p className="text-xs font-medium text-primary">Total XP</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <span className="numeric-readout">{formatXp(user.level.currentXp)}</span>
          </p>
        </div>
        <div className="neon-metric rounded-[var(--radius-universal)] p-5">
          <p className="text-xs font-medium text-primary">To next level</p>
          <p className="mt-3 text-lg font-medium text-white">
            <span className="numeric-readout">
              {formatXpLabel(Math.max(0, user.level.nextLevelXp - user.level.currentXp))}
            </span>{" "}
            left
          </p>
          <p className="mt-2 text-sm text-muted">
            Target: <span className="numeric-readout">{formatXpLabel(user.level.nextLevelXp)}</span>
          </p>
        </div>
      </div>
      <XPProgress current={user.level.currentXp} next={user.level.nextLevelXp} />
      <ContributionPulseStrip contributions={user.contributions} label="14-day activity pulse" />
      {identitySummary ? (
        <div className="rounded-[var(--radius-universal)] border border-cyan-300/20 bg-cyan-400/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-cyan-200">
              Identity brief ({aiSourceLabel})
            </p>
            <CopyTextButton
              text={identitySummary}
              label="Copy summary"
              copiedLabel="Summary copied"
              analyticsTarget="dashboard/identity-summary"
              size="sm"
              variant="ghost"
            />
          </div>
          <ExpandableText
            text={identitySummary}
            lines={4}
            minLengthForToggle={220}
            className="mt-2"
            textClassName="break-anywhere text-sm leading-6 text-muted"
          />
        </div>
      ) : null}
      <div className="space-y-3">
        <p className="text-xs font-medium text-primary">Top signals (latest evidence)</p>
        <ul role="list" className="flex flex-wrap gap-2">
          {strongestSignals.map((signal) => (
            <li key={`${user.username}-${signal}`} className="list-none">
              <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
                <Star className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {signal}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlowCard>
  );
}
