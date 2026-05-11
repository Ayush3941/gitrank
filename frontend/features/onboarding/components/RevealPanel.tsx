import Link from "next/link";
import { ArrowRight, Award, Sparkles } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/gitrank";

export function RevealPanel({ user }: { user: UserProfile }) {
  const strongestSignals =
    user.strongestSignals.length > 0 ? user.strongestSignals.join(", ") : "recent contribution";

  return (
    <main className="mx-auto max-w-5xl">
      <GlowCard strong className="space-y-8 panel-grid text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Analysis complete
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Level {user.level.currentLevel} <span className="text-gradient">{user.title}</span>
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted">
            This first snapshot shows recurring signals in {strongestSignals} work. Meaningful merged contributions currently place you in {user.level.rankTier}.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <RankBadge rank={user.level.rankTier} />
          <div className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-200">
            {user.level.currentXp} / {user.level.nextLevelXp} XP
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {user.badges.slice(0, 3).map((badge) => (
            <div key={badge.id} className="rounded-[1.75rem] border border-white/8 bg-white/5 p-5 text-left">
              <div className="flex items-center justify-between">
                <Award className="h-5 w-5 text-primary" />
                <RarityBadge rarity={badge.rarity} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-white">{badge.name}</h2>
              <p className="mt-2 text-sm text-muted">{badge.description}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">
              Enter dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href={`/u/${user.username}`}>View public profile</Link>
          </Button>
        </div>
      </GlowCard>
    </main>
  );
}

export function RevealPanelSkeleton() {
  return (
    <main className="mx-auto max-w-5xl">
      <GlowCard strong className="space-y-8 panel-grid text-center">
        <div className="mx-auto h-8 w-48 animate-pulse rounded-full bg-white/8" />
        <div className="mx-auto h-16 w-full max-w-2xl animate-pulse rounded-3xl bg-white/8" />
        <div className="mx-auto h-10 w-72 animate-pulse rounded-full bg-white/8" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-[1.75rem] bg-white/8" />
          ))}
        </div>
      </GlowCard>
    </main>
  );
}

export function RevealPanelUnavailable() {
  return (
    <main className="mx-auto max-w-3xl">
      <GlowCard strong className="space-y-6 panel-grid text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-amber-100 uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          Profile unavailable
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Connect GitHub to reveal your first GitRank snapshot.
        </h1>
        <p className="text-sm text-muted">
          The reveal page now reads the authenticated profile snapshot instead of a static sample. Start or refresh the GitHub connection to generate the live view.
        </p>
        <Button asChild size="lg">
          <Link href="/onboarding/connect-github">
            Connect GitHub
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </GlowCard>
    </main>
  );
}
