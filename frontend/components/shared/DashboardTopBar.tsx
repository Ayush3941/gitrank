"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { EffectsQuickSwitcher } from "@/components/shared/EffectsQuickSwitcher";
import { RankBadge } from "@/components/shared/RankBadge";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
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
    <div className={cn(embedded ? "px-2 py-1 sm:px-3 sm:py-1.5" : "dashboard-nav-shell px-4 py-2.5 sm:px-5")}>
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="neon-chip neon-chip-muted inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium text-muted">
            @{user.username}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <SyncStatusPill status={user.syncStatus} />
            <RankBadge rank={user.level.rankTier} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeQuickSwitcher compact className="h-8 px-2.5" />
          <TextScaleQuickSwitcher compact className="h-8 px-2.5" />
          <EffectsQuickSwitcher compact className="h-8 px-2.5" />
        </div>
      </div>
    </div>
  );
}

export function DashboardTopBarSkeleton({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={cn(embedded ? "px-2 py-1 sm:px-3 sm:py-1.5" : "dashboard-nav-shell px-4 py-2.5 sm:px-5")}>
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-32 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
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
