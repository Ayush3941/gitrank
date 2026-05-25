"use client";

import Image from "next/image";
import { GitPullRequest, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { ContributionPulseStrip } from "@/components/shared/ContributionPulseStrip";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { XPProgress } from "@/components/shared/XPProgress";
import { uniqueDisplayValues } from "@/lib/display-values";
import type { UserProfile } from "@/types/gitrank";

export function PublicProfileHero({
  user,
  shareHeadline,
  archetype,
  identitySummary,
  identitySummaryMode = "deterministic",
}: {
  user: UserProfile;
  shareHeadline: string;
  archetype?: string;
  identitySummary?: string;
  identitySummaryMode?: "gemini" | "deterministic";
}) {
  const topSkills = uniqueDisplayValues(user.topSkills, 4);

  return (
    <GlowCard strong className="player-card-shell cyber-hero-shell overflow-hidden p-6 sm:p-8">
      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <div className="space-y-5">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="rank-orbit rounded-[2.1rem] p-[2px]">
              <Image
                src={user.avatarUrl}
                alt={`${user.displayName} avatar`}
                width={96}
                height={96}
                sizes="96px"
                priority
                className="cyber-avatar h-24 w-24 rounded-[2rem]"
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="break-anywhere text-2xl font-semibold text-white">{user.displayName}</h2>
                <RankBadge rank={user.level.rankTier} />
              </div>
              <p className="text-sm text-muted">@{user.username}</p>
              <p className="break-anywhere text-sm text-muted">
                {user.title}
                {archetype ? ` • ${archetype}` : ""}
              </p>
            </div>
          </div>
          <ExpandableText
            text={user.bio}
            lines={4}
            minLengthForToggle={220}
            className="max-w-3xl"
            textClassName="break-anywhere text-sm leading-7 text-muted"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniMetric icon={<GitPullRequest className="h-4 w-4" />} label="Merged PRs" value={user.mergedPrCount.toLocaleString("en-US")} />
            <MiniMetric icon={<Sparkles className="h-4 w-4" />} label="GitRank score" value={user.gitRankScore.toLocaleString("en-US")} />
            <MiniMetric icon={<ShieldCheck className="h-4 w-4" />} label="Consistency" value={`${user.consistencyScore}%`} />
          </div>
          {identitySummary ? (
            <div className="neon-callout rounded-2xl px-4 py-3 text-sm text-muted">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="cyber-readout text-xs font-medium text-cyan-200">
                  Identity summary ({identitySummaryMode === "gemini" ? "Gemini" : "Deterministic"})
                </p>
                <CopyTextButton
                  text={identitySummary}
                  label="Copy summary"
                  copiedLabel="Summary copied"
                  analyticsTarget="public-profile/identity-summary"
                  size="sm"
                  variant="ghost"
                />
              </div>
              <ExpandableText
                text={identitySummary}
                lines={4}
                minLengthForToggle={220}
                className="mt-2"
                textClassName="break-anywhere leading-6"
              />
            </div>
          ) : null}
          <p className="text-xs font-medium text-primary">Top signals (public evidence)</p>
          <ul role="list" className="flex flex-wrap gap-2">
            {topSkills.map((skill, index) => (
              <li key={`${skill}-${index}`}>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 text-sm text-muted">
                  {skill}
                </span>
              </li>
            ))}
          </ul>
          <ContributionPulseStrip
            contributions={user.contributions}
            days={10}
            label="10-day public contribution pulse"
          />
          <div className="flex flex-wrap gap-2">
            <ShareProfileButton
              variant="secondary"
              username={user.username}
              displayName={user.displayName}
              shareHeadline={shareHeadline}
              analyticsTargetPrefix="public-profile"
            />
          </div>
        </div>
        <div className="neon-surface rounded-[1.85rem] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary">Profile card</p>
              <p className="mt-2 text-4xl font-semibold text-white">Lv. {user.level.currentLevel}</p>
            </div>
            <div className="hud-pill rounded-3xl p-3 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
          <XPProgress className="mt-5" current={user.level.currentXp} next={user.level.nextLevelXp} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniMetric icon={<Sparkles className="h-4 w-4" />} label="Season XP" value={user.rankProgress.seasonXp.toLocaleString("en-US")} />
            <MiniMetric icon={<ShieldCheck className="h-4 w-4" />} label="Formula" value={user.rankProgress.season.scoringVersion} />
          </div>
          <p className="cyber-readout mt-4 text-xs leading-5 text-muted">Evidence-backed snapshot.</p>
        </div>
      </div>
    </GlowCard>
  );
}

function MiniMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="neon-metric rounded-[1.4rem] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
