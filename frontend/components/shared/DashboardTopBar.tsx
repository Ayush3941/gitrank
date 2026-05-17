import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Zap } from "lucide-react";
import { RankBadge } from "@/components/shared/RankBadge";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
import type { UserProfile } from "@/types/gitrank";

export function DashboardTopBar({ user }: { user: UserProfile }) {
  return (
    <div className="glass-panel cyber-card cyber-frame panel-grid sticky top-4 z-30 mb-6 flex flex-col gap-4 rounded-[2rem] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <SyncStatusPill status={user.syncStatus} />
        <RankBadge rank={user.level.rankTier} />
        <div className="hud-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="numeric-readout">{user.weeklyXp.toLocaleString("en-US")}</span> weekly XP
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ThemeQuickSwitcher compact />
        <TextScaleQuickSwitcher compact />
        <Link
          href={`/u/${user.username}`}
          className="focus-ring cyber-link inline-flex items-center gap-2 text-sm font-medium"
        >
          View public profile
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <ShareProfileButton
          variant="ghost"
          size="sm"
          username={user.username}
          displayName={user.displayName}
          shareHeadline={`${user.displayName} is ${user.title} on GitRank.`}
          analyticsTargetPrefix="dashboard-topbar"
        />
      </div>
    </div>
  );
}

export function DashboardTopBarSkeleton() {
  return (
    <div className="glass-panel cyber-card cyber-frame panel-grid sticky top-4 z-30 mb-6 flex flex-col gap-4 rounded-[2rem] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="neon-skeleton h-8 w-32 rounded-full" />
        <div className="neon-skeleton h-8 w-24 rounded-full" />
        <div className="neon-skeleton h-8 w-28 rounded-full" />
      </div>
      <div className="neon-skeleton h-5 w-36 rounded-full" />
    </div>
  );
}

export function DashboardTopBarUnavailable() {
  return (
    <div className="glass-panel cyber-card cyber-frame panel-grid sticky top-4 z-30 mb-6 flex flex-col gap-4 rounded-[2rem] border border-amber-400/24 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="inline-flex items-center gap-2 text-sm text-amber-100">
        <AlertTriangle className="h-4 w-4" />
        Authenticated profile unavailable
      </div>
      <Link
        href="/login?return_to=/dashboard"
        className="focus-ring cyber-link inline-flex items-center gap-2 text-sm font-medium"
      >
        Reconnect GitHub
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
