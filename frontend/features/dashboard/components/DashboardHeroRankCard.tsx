import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { XPProgress } from "@/components/shared/XPProgress";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/gitrank";

export function DashboardHeroRankCard({ user }: { user: UserProfile }) {
  return (
    <GlowCard strong className="space-y-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src={user.avatarUrl}
            alt={`${user.displayName} avatar`}
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-[1.75rem] border border-white/10 bg-white/6"
          />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-2xl font-semibold text-white">{user.displayName}</p>
              <RankBadge rank={user.level.rankTier} />
            </div>
            <p className="text-sm text-muted">@{user.username}</p>
            <p className="text-sm text-slate-200">{user.title}</p>
          </div>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/u/${user.username}`}>
            Public profile
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-5">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Level</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <AnimatedNumber value={user.level.currentLevel} />
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-5">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Total XP</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <AnimatedNumber value={user.level.currentXp} />
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-5">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Next title gate</p>
          <p className="mt-3 text-lg font-medium text-white">Reach {user.level.nextLevelXp} XP</p>
          <p className="mt-2 text-sm text-muted">Unlock stronger rank movement, harder quests, and rarer badge lanes.</p>
        </div>
      </div>
      <XPProgress current={user.level.currentXp} next={user.level.nextLevelXp} />
      <div className="space-y-3">
        <p className="text-xs tracking-[0.24em] text-primary uppercase">Top observed signals in this snapshot</p>
        <div className="flex flex-wrap gap-2">
          {user.strongestSignals.map((signal) => (
            <div key={signal} className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-sm text-slate-200">
              <Star className="h-3.5 w-3.5 text-primary" />
              {signal}
            </div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}
