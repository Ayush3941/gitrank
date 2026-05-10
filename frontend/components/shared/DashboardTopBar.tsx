import Link from "next/link";
import { ArrowUpRight, Zap } from "lucide-react";
import { RankBadge } from "@/components/shared/RankBadge";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import type { UserProfile } from "@/types/gitrank";

export function DashboardTopBar({ user }: { user: UserProfile }) {
  return (
    <div className="glass-panel sticky top-4 z-30 mb-6 flex flex-col gap-4 rounded-[2rem] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <SyncStatusPill status={user.syncStatus} />
        <RankBadge rank={user.level.rankTier} />
        <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-muted">
          <Zap className="h-3.5 w-3.5 text-primary" />
          {user.weeklyXp} weekly XP
        </div>
      </div>
      <Link
        href={`/u/${user.username}`}
        className="focus-ring inline-flex items-center gap-2 text-sm font-medium text-slate-200 transition hover:text-white"
      >
        View public profile
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
