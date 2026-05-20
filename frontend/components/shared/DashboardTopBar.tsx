"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, UserRound, Zap } from "lucide-react";
import { RankBadge } from "@/components/shared/RankBadge";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
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
  const pathname = usePathname();
  const activeLane =
    dashboardNavItems.find((item) =>
      item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
    ) ?? dashboardNavItems[0];
  const ActiveLaneIcon = activeLane.icon;
  const breadcrumbItems =
    activeLane.href === "/dashboard"
      ? [{ label: "Dashboard", href: "/dashboard" }]
      : [
          { label: "Dashboard", href: "/dashboard" },
          { label: activeLane.label, href: activeLane.href },
        ];
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
    <div className="glass-panel cyber-card cyber-frame mb-6 px-5 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="flex flex-col gap-2">
          <nav aria-label="Breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1.5 text-xs text-cyan-100">
              {breadcrumbItems.map((item, index) => {
                const isCurrent = index === breadcrumbItems.length - 1;
                return (
                  <li key={item.href} className="inline-flex min-w-0 items-center gap-1.5">
                    {isCurrent ? (
                      <span aria-current="page" className="break-anywhere font-semibold text-white">
                        {item.label}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        prefetch={false}
                        className="focus-ring text-cyan-100 hover:text-white"
                      >
                        {item.label}
                      </Link>
                    )}
                    {!isCurrent ? (
                      <span aria-hidden="true" className="text-cyan-100/70">
                        /
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>
          <div className="hud-pill inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs text-cyan-100">
            <ActiveLaneIcon className="h-3.5 w-3.5 text-primary" />
            <span className="break-anywhere leading-5">{activeLane.hint}</span>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-2.5">
            <SyncStatusPill status={user.syncStatus} />
            <RankBadge rank={user.level.rankTier} />
            <div className="hud-pill inline-flex items-center gap-2 px-3 py-1.5 text-xs text-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="numeric-readout">{user.weeklyXp.toLocaleString("en-US")}</span> weekly XP
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/u/${user.username}`}
              prefetch={false}
              className="focus-ring cyber-link hidden items-center gap-2 text-sm font-medium xl:inline-flex"
            >
              View public profile
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/u/${user.username}`}
              prefetch={false}
              className="focus-ring inline-flex items-center gap-2 border border-primary/24 bg-primary/10 px-3 py-1.5 text-sm font-medium text-cyan-100 xl:hidden"
            >
              <UserRound className="h-4 w-4" />
              Profile
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
      </div>
      <div className="mt-3 min-h-6">
        {autoSyncNote ? (
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${autoSyncToneClass}`}
          >
            {AutoSyncIcon ? <AutoSyncIcon className="h-4 w-4 shrink-0" /> : null}
            <span>{autoSyncNote.message}</span>
          </p>
        ) : (
          <p aria-hidden="true" className="text-sm text-transparent select-none">
            Sync note
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardTopBarSkeleton() {
  return (
    <div className="glass-panel cyber-card cyber-frame mb-6 px-5 py-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="space-y-2">
          <div className="neon-skeleton h-5 w-44 rounded-full" />
          <div className="neon-skeleton h-8 w-[min(34rem,100%)] rounded-full" />
        </div>
        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <div className="neon-skeleton h-8 w-32 rounded-full" />
            <div className="neon-skeleton h-8 w-24 rounded-full" />
            <div className="neon-skeleton h-8 w-28 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="neon-skeleton h-8 w-28 rounded-full" />
            <div className="neon-skeleton h-8 w-32 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mt-3 min-h-6">
        <div className="neon-skeleton h-4 w-3/4 rounded-full" />
      </div>
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
