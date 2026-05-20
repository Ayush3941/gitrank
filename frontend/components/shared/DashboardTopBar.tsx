"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, Zap } from "lucide-react";
import { RankBadge } from "@/components/shared/RankBadge";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import type { UserProfile } from "@/types/gitrank";

export type AutoSyncNote = {
  tone: "info" | "success" | "warning";
  message: string;
};

export function DashboardTopBar({
  user,
  autoSyncNote,
}: {
  user: UserProfile;
  autoSyncNote?: AutoSyncNote | null;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const activeLane =
    dashboardNavItems.find((item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? dashboardNavItems[0];
  const ActiveLaneIcon = activeLane.icon;
  const autoSyncToneClass =
    autoSyncNote?.tone === "success"
      ? "neon-chip neon-chip-success border-emerald-300/30 text-emerald-100"
      : autoSyncNote?.tone === "warning"
        ? "neon-chip neon-chip-warning border-amber-300/34 text-amber-100"
        : "neon-chip neon-chip-info border-primary/28 text-foreground";
  const AutoSyncIcon =
    autoSyncNote?.tone === "success"
      ? CheckCircle2
      : autoSyncNote?.tone === "warning"
        ? AlertTriangle
        : Info;

  return (
    <div className="glass-panel cyber-card cyber-frame mb-6 px-5 py-4 [overflow-anchor:none]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex min-w-0 items-center gap-2">
          <span className="hud-pill inline-flex h-8 w-8 items-center justify-center rounded-full text-primary">
            <ActiveLaneIcon className="h-4 w-4" />
          </span>
          <p className="truncate text-base font-semibold text-white">{activeLane.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SyncStatusPill status={user.syncStatus} />
          <RankBadge rank={user.level.rankTier} />
          <div className="hud-pill inline-flex items-center gap-2 px-3 py-1.5 text-xs text-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="numeric-readout">{user.weeklyXp.toLocaleString("en-US")}</span> weekly XP
          </div>
          <Link
            href={`/u/${user.username}`}
            prefetch={false}
            className="focus-ring cyber-link inline-flex items-center gap-2 text-sm font-medium"
          >
            View public profile
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          autoSyncNote
            ? `mt-3 inline-flex min-h-6 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${autoSyncToneClass}`
            : "mt-3 min-h-6 text-xs opacity-0 pointer-events-none select-none"
        }
      >
        {autoSyncNote ? (
          <>
            {AutoSyncIcon ? <AutoSyncIcon className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="break-anywhere">{autoSyncNote.message}</span>
          </>
        ) : (
          "Background sync status"
        )}
      </p>
    </div>
  );
}

export function DashboardTopBarSkeleton() {
  return (
    <div className="glass-panel cyber-card cyber-frame mb-6 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="neon-skeleton h-8 w-8 rounded-[0.1rem]" />
          <div className="neon-skeleton h-5 w-40 rounded-[0.1rem]" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="neon-skeleton h-8 w-32 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-28 rounded-full" />
          <div className="neon-skeleton h-8 w-28 rounded-full" />
          <div className="neon-skeleton h-8 w-32 rounded-full" />
        </div>
      </div>
      <div className="neon-skeleton mt-3 h-4 w-3/4 rounded-full" />
    </div>
  );
}

export function DashboardTopBarUnavailable() {
  return (
    <div className="glass-panel cyber-card cyber-frame mb-6 border border-amber-400/24 px-5 py-4">
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
