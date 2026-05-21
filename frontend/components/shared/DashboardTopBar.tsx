"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, Zap } from "lucide-react";
import { RankBadge } from "@/components/shared/RankBadge";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
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
    <div className="glass-panel cyber-card cyber-frame mb-4 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="cyber-avatar relative h-11 w-11 shrink-0 overflow-hidden rounded-full">
            <Image
              src={user.avatarUrl}
              alt={`${user.displayName} avatar`}
              fill
              sizes="44px"
              className="object-cover"
              priority={false}
            />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold text-white sm:text-base">{user.displayName}</p>
            <p className="truncate text-xs text-muted">
              @{user.username}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <SyncStatusPill status={user.syncStatus} />
          <RankBadge rank={user.level.rankTier} />
          <div className="hud-pill inline-flex items-center gap-2 px-3 py-1.5 text-xs text-foreground">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="numeric-readout">{user.weeklyXp.toLocaleString("en-US")}</span> XP
          </div>
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={
          autoSyncNote
            ? `mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${autoSyncToneClass}`
            : "sr-only"
        }
      >
        {autoSyncNote ? (
          <>
            {AutoSyncIcon ? <AutoSyncIcon className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="break-anywhere">{autoSyncNote.message}</span>
          </>
        ) : (
          "No active background sync notice."
        )}
      </p>
    </div>
  );
}

export function DashboardTopBarSkeleton() {
  return (
    <div className="glass-panel cyber-card cyber-frame mb-6 px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="neon-skeleton h-11 w-11 rounded-full" />
          <div className="space-y-2">
            <div className="neon-skeleton h-4 w-36 rounded-[0.1rem]" />
            <div className="neon-skeleton h-3 w-28 rounded-[0.1rem]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="neon-skeleton h-8 w-32 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-28 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
        </div>
      </div>
      <div className="neon-skeleton mt-2 h-4 w-2/3 rounded-full" />
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
