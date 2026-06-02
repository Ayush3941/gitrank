import Image from "next/image";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { ContributionPulseStrip } from "@/components/shared/ContributionPulseStrip";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { RankBadge } from "@/components/shared/RankBadge";
import { XPProgress } from "@/components/shared/XPProgress";
import { Button } from "@/components/ui/button";
import { uniqueDisplayValues } from "@/lib/display-values";
import type { UserProfile } from "@/types/gitrank";

export function DashboardHeroRankCard({
  user,
  archetype,
  identitySummary,
  aiMode,
  effectiveSyncState,
}: {
  user: UserProfile;
  archetype?: string;
  identitySummary?: string;
  aiMode?: "openai" | "deterministic";
  effectiveSyncState?: UserProfile["syncStatus"]["state"];
}) {
  const strongestSignals = uniqueDisplayValues(user.strongestSignals, 4);
  const syncState = effectiveSyncState ?? user.syncStatus.state;
  const nextAction =
    syncState !== "synced" || user.mergedPrCount === 0
      ? {
          description: "Sync recent PR evidence to unlock rank progression.",
          href: "/dashboard/settings",
          cta: "Open sync settings",
        }
      : user.quests.length > 0
        ? {
            description: "Quest completion is the fastest path to rank movement this cycle.",
            href: "/dashboard/quests",
            cta: "Open quests",
          }
        : {
            description: "Review high-impact PR cards and keep evidence quality moving upward.",
            href: "/dashboard/contributions",
            cta: "Open contributions",
          };

  return (
    <GlowCard strong className="player-card-shell cyber-hero-shell space-y-6 overflow-hidden">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="rank-orbit rounded-[2rem] p-[2px]">
            <Image
              src={user.avatarUrl}
              alt={`${user.displayName} avatar`}
              width={72}
              height={72}
              sizes="72px"
              priority
              className="cyber-avatar h-[72px] w-[72px] rounded-[1.85rem]"
            />
          </div>
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
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs font-medium text-primary">Level</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <span className="numeric-readout">{user.level.currentLevel.toLocaleString("en-US")}</span>
          </p>
        </div>
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs font-medium text-primary">Total XP</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <span className="numeric-readout">{user.level.currentXp.toLocaleString("en-US")}</span>
          </p>
        </div>
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs font-medium text-primary">To next level</p>
          <p className="mt-3 text-lg font-medium text-white">
            <span className="numeric-readout">{Math.max(0, user.level.nextLevelXp - user.level.currentXp).toLocaleString("en-US")}</span> XP left
          </p>
          <p className="mt-2 text-sm text-muted">
            Target: <span className="numeric-readout">{user.level.nextLevelXp.toLocaleString("en-US")}</span> XP
          </p>
        </div>
      </div>
      <XPProgress current={user.level.currentXp} next={user.level.nextLevelXp} />
      <ContributionPulseStrip contributions={user.contributions} label="14-day activity pulse" />
      <div className="rounded-[1.75rem] border border-primary/18 bg-primary/8 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="h-4 w-4 text-emerald-200" aria-hidden="true" />
              Next move
            </p>
            <p className="text-sm leading-6 text-muted">
              {user.rankProgress.nextTier
                ? `${user.rankProgress.xpToNextTier.toLocaleString("en-US")} XP to ${user.rankProgress.nextTier}.`
                : "Top tier reached for this season."}
            </p>
            <p className="text-sm leading-6 text-muted">{nextAction.description}</p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <IntentPrefetchLink href={nextAction.href}>
              {nextAction.cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </IntentPrefetchLink>
          </Button>
        </div>
      </div>
      {identitySummary ? (
        <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-cyan-200">
              Identity brief ({aiMode === "openai" ? "ChatGPT" : "Deterministic"})
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
