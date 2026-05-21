"use client";

import Image from "next/image";
import { ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { ExpandableText } from "@/components/shared/ExpandableText";
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
}: {
  user: UserProfile;
  shareHeadline: string;
  archetype?: string;
  identitySummary?: string;
}) {
  const topSkills = uniqueDisplayValues(user.topSkills, 6);

  return (
    <div className="player-card-shell glass-panel-strong overflow-hidden rounded-[2rem] p-6 sm:p-8">
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
          {identitySummary ? (
            <div className="neon-callout rounded-2xl px-4 py-3 text-sm text-muted">
              <p className="cyber-readout text-xs font-medium text-cyan-200">Identity summary</p>
              <ExpandableText
                text={identitySummary}
                lines={4}
                minLengthForToggle={220}
                className="mt-2"
                textClassName="break-anywhere leading-6"
              />
            </div>
          ) : null}
          <ul role="list" className="flex flex-wrap gap-2">
            {topSkills.map((skill, index) => (
              <li key={`${skill}-${index}`}>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 text-sm text-muted">
                  {skill}
                </span>
              </li>
            ))}
          </ul>
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
              <p className="text-xs font-medium text-primary">Player card</p>
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
          <p className="cyber-readout mt-4 text-xs leading-5 text-muted">Evidence-backed public snapshot.</p>
        </div>
      </div>
    </div>
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
