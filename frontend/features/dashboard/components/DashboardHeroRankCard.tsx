import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { XPProgress } from "@/components/shared/XPProgress";
import { Button } from "@/components/ui/button";
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
  aiMode?: "gemini" | "deterministic";
}) {
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
            <p className="break-anywhere text-sm text-slate-200">
              {user.title}
              {archetype ? ` • ${archetype}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/u/${user.username}`}>
              Public profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <ShareProfileButton
            variant="ghost"
            size="sm"
            username={user.username}
            displayName={user.displayName}
            shareHeadline={`${user.displayName} is ${user.title} on GitRank.`}
            analyticsTargetPrefix="dashboard-profile"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Level</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <AnimatedNumber value={user.level.currentLevel} />
          </p>
        </div>
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Total XP</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <AnimatedNumber value={user.level.currentXp} />
          </p>
        </div>
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Next title gate</p>
          <p className="mt-3 text-lg font-medium text-white">
            Reach <span className="numeric-readout">{user.level.nextLevelXp.toLocaleString("en-US")}</span> XP
          </p>
          <p className="mt-2 text-sm text-muted">Unlock stronger rank movement, harder quests, and rarer badge lanes.</p>
        </div>
      </div>
      <XPProgress current={user.level.currentXp} next={user.level.nextLevelXp} />
      <div className="rounded-[1.75rem] border border-emerald-400/16 bg-emerald-400/8 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-emerald-200" />
          <div>
            <p className="text-sm font-semibold text-white">Rank-up preview</p>
            <p className="mt-1 text-sm leading-6 text-slate-200/78">
              {user.rankProgress.nextTier
                ? `This season needs ${user.rankProgress.xpToNextTier.toLocaleString("en-US")} more evidence-backed XP before ${user.rankProgress.nextTier} review.`
                : "The current profile is already at the highest configured rank tier."}
            </p>
          </div>
        </div>
      </div>
      {identitySummary ? (
        <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/8 p-4">
          <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">
            Open-source identity summary ({aiMode === "gemini" ? "Gemini" : "Deterministic"})
          </p>
          <ExpandableText
            text={identitySummary}
            lines={4}
            minLengthForToggle={220}
            className="mt-2"
            textClassName="break-anywhere text-sm leading-6 text-slate-200/84"
          />
        </div>
      ) : null}
      <div className="space-y-3">
        <p className="text-xs tracking-[0.24em] text-primary uppercase">Top observed signals in this snapshot</p>
        <div className="flex flex-wrap gap-2">
          {user.strongestSignals.map((signal) => (
            <div key={signal} className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
              <Star className="h-3.5 w-3.5 text-primary" />
              {signal}
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}
