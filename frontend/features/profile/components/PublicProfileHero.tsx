"use client";

import Image from "next/image";
import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RankBadge } from "@/components/shared/RankBadge";
import type { UserProfile } from "@/types/gitrank";

export function PublicProfileHero({
  user,
  shareHeadline,
}: {
  user: UserProfile;
  shareHeadline: string;
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
    <div className="glass-panel-strong rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src={user.avatarUrl}
            alt={`${user.displayName} avatar`}
            width={80}
            height={80}
            className="h-20 w-20 rounded-[1.75rem] border border-white/10 bg-white/6"
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-white">{user.displayName}</h1>
              <RankBadge rank={user.level.rankTier} />
            </div>
            <p className="text-sm text-muted">@{user.username}</p>
            <p className="text-sm text-slate-200">{user.title}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          {shareState === "copied" ? "Link copied" : "Share profile"}
        </Button>
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-200/82">{user.bio}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {user.topSkills.map((skill) => (
          <div key={skill} className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
            {skill}
          </div>
        ))}
      </div>
    </div>
  );
}
