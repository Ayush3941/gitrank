"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Zap } from "lucide-react";
import { RankBadge } from "@/components/shared/RankBadge";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { cn } from "@/lib/cn";
import type { UserProfile } from "@/types/gitrank";

export function DashboardTopBar({
  user,
  embedded = false,
}: {
  user: UserProfile;
  embedded?: boolean;
}) {
  return (
    <div className={cn(embedded ? "px-2.5 py-1 sm:px-3 sm:py-1.5" : "dashboard-nav-shell px-4 py-2.5 sm:px-5")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="cyber-avatar relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
            <Image
              src={user.avatarUrl}
              alt={`${user.displayName} avatar`}
              fill
              sizes="40px"
              className="object-cover"
              priority={false}
            />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold text-white">{user.displayName}</p>
            <p className="truncate text-xs text-muted">@{user.username}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 lg:flex">
            <ThemeQuickSwitcher compact className="h-8 px-2.5" />
            <TextScaleQuickSwitcher compact className="h-8 px-2.5" />
          </div>
          <SyncStatusPill status={user.syncStatus} />
          <RankBadge rank={user.level.rankTier} />
          <div className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="numeric-readout">{user.weeklyXp.toLocaleString("en-US")}</span> XP
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardTopBarSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={cn(embedded ? "px-2.5 py-1 sm:px-3 sm:py-1.5" : "dashboard-nav-shell px-4 py-2.5 sm:px-5")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="neon-skeleton h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <div className="neon-skeleton h-4 w-36 rounded-[0.1rem]" />
            <div className="neon-skeleton h-3 w-28 rounded-[0.1rem]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="neon-skeleton h-8 w-32 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function DashboardTopBarUnavailable({ embedded = false }: { embedded?: boolean }) {
  if (embedded) {
    return (
      <div className="flex flex-col gap-3 px-2.5 py-1.5 sm:px-3">
        <div className="inline-flex items-center gap-2 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          Authenticated profile unavailable
        </div>
        <Link
          href="/login?return_to=/dashboard"
          prefetch={false}
          className="focus-ring cyber-link inline-flex w-fit items-center gap-2 text-sm font-medium"
        >
          Reconnect GitHub
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="glass-panel cyber-card cyber-frame mb-5 border border-amber-400/24 px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex items-center gap-2 text-sm text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          Authenticated profile unavailable
        </div>
        <Link
          href="/login?return_to=/dashboard"
          prefetch={false}
          className="focus-ring cyber-link inline-flex items-center gap-2 text-sm font-medium"
        >
          Reconnect GitHub
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
      <p aria-hidden="true" className="mt-3 min-h-6 text-sm opacity-0 select-none">
        Background sync status
      </p>
    </div>
  );
}
