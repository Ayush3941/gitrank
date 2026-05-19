"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Info, Zap } from "lucide-react";
import { DashboardQuickActions } from "@/components/shared/DashboardQuickActions";
import { DashboardShortcutHelpDialog } from "@/components/shared/DashboardShortcutHelpDialog";
import { GamificationQuickSwitcher } from "@/components/shared/GamificationQuickSwitcher";
import { RankBadge } from "@/components/shared/RankBadge";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
import { Button } from "@/components/ui/button";
import type { UserProfile } from "@/types/gitrank";

export type AutoSyncNote = {
  tone: "info" | "success" | "warning";
  message: string;
};

export function DashboardTopBar({
  user,
  autoSyncNote,
  showQuickActions = false,
}: {
  user: UserProfile;
  autoSyncNote?: AutoSyncNote | null;
  showQuickActions?: boolean;
}) {
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const autoSyncToneClass =
    autoSyncNote?.tone === "success"
      ? "neon-chip neon-chip-success border-emerald-300/30 text-emerald-100"
      : autoSyncNote?.tone === "warning"
        ? "neon-chip neon-chip-warning border-amber-300/34 text-amber-100"
        : "neon-chip neon-chip-info border-primary/28 text-slate-100";
  const AutoSyncIcon =
    autoSyncNote?.tone === "success"
      ? CheckCircle2
      : autoSyncNote?.tone === "warning"
        ? AlertTriangle
        : Info;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      const isQuestionShortcut = event.key === "?" || (event.shiftKey && event.key === "/");
      if (!isQuestionShortcut) {
        return;
      }
      event.preventDefault();
      setShortcutHelpOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <div className="glass-panel cyber-card cyber-frame sticky top-4 z-30 mb-6 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <SyncStatusPill status={user.syncStatus} />
            <RankBadge rank={user.level.rankTier} />
            <div className="hud-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="numeric-readout">{user.weeklyXp.toLocaleString("en-US")}</span> weekly XP
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {showQuickActions ? (
              <DashboardQuickActions
                username={user.username}
                onOpenShortcutsHelp={() => {
                  setShortcutHelpOpen(true);
                }}
              />
            ) : null}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShortcutHelpOpen(true);
              }}
              className="gap-2"
            >
              Shortcuts
              <kbd className="hidden text-[11px] sm:inline">?</kbd>
            </Button>
            <GamificationQuickSwitcher compact className="hidden md:inline-flex" />
            <ThemeQuickSwitcher compact className="hidden sm:inline-flex" />
            <TextScaleQuickSwitcher compact className="hidden sm:inline-flex" />
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
      {shortcutHelpOpen ? (
        <DashboardShortcutHelpDialog
          open={shortcutHelpOpen}
          onOpenChange={setShortcutHelpOpen}
        />
      ) : null}
    </>
  );
}

export function DashboardTopBarSkeleton() {
  return (
    <div className="glass-panel cyber-card cyber-frame sticky top-4 z-30 mb-6 px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="neon-skeleton h-8 w-32 rounded-full" />
          <div className="neon-skeleton h-8 w-24 rounded-full" />
          <div className="neon-skeleton h-8 w-28 rounded-full" />
        </div>
        <div className="neon-skeleton h-5 w-36 rounded-full" />
      </div>
      <div className="mt-3 min-h-6">
        <div className="neon-skeleton h-4 w-3/4 rounded-full" />
      </div>
    </div>
  );
}

export function DashboardTopBarUnavailable() {
  return (
    <div className="glass-panel cyber-card cyber-frame sticky top-4 z-30 mb-6 border border-amber-400/24 px-5 py-4">
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

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox'], [aria-multiline='true']",
    ),
  );
}
