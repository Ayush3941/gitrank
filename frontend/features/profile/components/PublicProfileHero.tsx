"use client";

import Image from "next/image";
import { Share2, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/shared/RankBadge";
import { XPProgress } from "@/components/shared/XPProgress";
import type { UserProfile } from "@/types/gitrank";

export function PublicProfileHero({
  user,
  shareHeadline,
  archetype,
  identitySummary,
  aiMode,
}: {
  user: UserProfile;
  shareHeadline: string;
  archetype?: string;
  identitySummary?: string;
  aiMode?: "gemini" | "deterministic";
}) {
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  async function handleShare() {
    const url = window.location.href;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `${user.displayName} on GitRank`,
          text: shareHeadline,
          url,
        });
        return;
      } catch {
        // Fall back to clipboard copy.
      }
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      window.prompt("Copy this profile URL", url);
      return;
    }
    setShareState("copied");
    window.setTimeout(() => setShareState("idle"), 1600);
  }

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
                className="h-24 w-24 rounded-[2rem] border border-white/10 bg-white/6"
              />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-semibold text-white">{user.displayName}</h1>
                <RankBadge rank={user.level.rankTier} />
              </div>
              <p className="text-sm text-muted">@{user.username}</p>
              <p className="text-sm text-slate-200">
                {user.title}
                {archetype ? ` • ${archetype}` : ""}
              </p>
            </div>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-slate-200/82">{user.bio}</p>
          {identitySummary ? (
            <div className="rounded-2xl border border-cyan-300/24 bg-cyan-400/8 px-4 py-3 text-sm text-slate-200/88">
              <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">
                Open Source Identity ({aiMode === "gemini" ? "Gemini" : "Deterministic"})
              </p>
              <p className="mt-2 leading-6">{identitySummary}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {user.topSkills.map((skill) => (
              <div key={skill} className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
                {skill}
              </div>
            ))}
          </div>
          <Button variant="secondary" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            {shareState === "copied" ? "Link copied" : "Share profile"}
          </Button>
        </div>
        <div className="rounded-[1.85rem] border border-white/8 bg-white/5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs tracking-[0.24em] text-primary uppercase">Player card</p>
              <p className="mt-2 text-4xl font-semibold text-white">Lv. {user.level.currentLevel}</p>
            </div>
            <div className="rounded-3xl bg-primary/12 p-3 text-primary">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
          <XPProgress className="mt-5" current={user.level.currentXp} next={user.level.nextLevelXp} />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniMetric icon={<Sparkles className="h-4 w-4" />} label="Season XP" value={user.rankProgress.seasonXp.toLocaleString("en-US")} />
            <MiniMetric icon={<ShieldCheck className="h-4 w-4" />} label="Formula" value={user.rankProgress.season.scoringVersion} />
          </div>
          <p className="mt-4 text-xs leading-5 text-muted">
            {shareHeadline}. Public claims are backed by score events, badges, and PR evidence where visibility allows.
          </p>
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
    <div className="rounded-[1.4rem] border border-white/8 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs tracking-[0.2em] text-muted uppercase">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
