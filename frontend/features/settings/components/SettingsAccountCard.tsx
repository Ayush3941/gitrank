"use client";

import { FolderGit2, LogOut, RefreshCw } from "lucide-react";
import { GitHubAppSyncBlockNotice } from "@/components/shared/GitHubAppSyncBlockNotice";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { Button } from "@/components/ui/button";
import type { SyncState, SyncStatus } from "@/types/gitrank";

export type SettingsAccountNoticeVariant = "info" | "success" | "warning" | "error";

export function SettingsAccountCard({
  username,
  syncStatus,
  displaySyncState,
  appInstallationBlocked,
  appBlockMessage,
  actionError,
  actionNotice,
  actionNoticeVariant,
  isActing,
  isFetchingProfile,
  isUserSyncPending,
  isRelinkPending,
  isLogoutPending,
  isUnlinkPending,
  onRefreshProfile,
  onReconnectGitHub,
  onSignOut,
  onDisconnectGitHub,
  onDismissNotice,
}: {
  username: string;
  syncStatus: SyncStatus;
  displaySyncState: SyncState;
  appInstallationBlocked: boolean;
  appBlockMessage?: string;
  actionError: string;
  actionNotice: string;
  actionNoticeVariant: SettingsAccountNoticeVariant;
  isActing: boolean;
  isFetchingProfile: boolean;
  isUserSyncPending: boolean;
  isRelinkPending: boolean;
  isLogoutPending: boolean;
  isUnlinkPending: boolean;
  onRefreshProfile: () => void;
  onReconnectGitHub: () => void;
  onSignOut: () => void;
  onDisconnectGitHub: () => void;
  onDismissNotice: () => void;
}) {
  const effectiveSyncStatus =
    displaySyncState === syncStatus.state
      ? syncStatus
      : { ...syncStatus, state: displaySyncState };
  const accountActionGridClassName = appInstallationBlocked
    ? "grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
    : "grid gap-2 sm:grid-cols-2 xl:grid-cols-5";

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">GitHub account</p>
          <h2 className="mt-2 text-xl font-semibold text-white">@{username}</h2>
        </div>
        <SyncStatusPill status={effectiveSyncStatus} />
      </div>
      <div className={accountActionGridClassName}>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={appInstallationBlocked || isActing || isFetchingProfile}
          onClick={onRefreshProfile}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {appInstallationBlocked
            ? "Install app to sync"
            : isUserSyncPending
              ? "Refreshing profile..."
              : isFetchingProfile
                ? "Refreshing..."
                : "Refresh profile"}
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={isActing}
          onClick={onReconnectGitHub}
        >
          <FolderGit2 className="h-4 w-4" aria-hidden="true" />
          {isRelinkPending ? "Starting relink..." : "Reconnect GitHub"}
        </Button>
        {!appInstallationBlocked ? (
          isActing ? (
            <Button variant="secondary" className="w-full justify-center" disabled>
              Manage GitHub App
            </Button>
          ) : (
            <Button
              asChild
              variant="secondary"
              className="w-full justify-center"
            >
              <IntentPrefetchLink href="/oauth/github/install">
                Manage GitHub App
              </IntentPrefetchLink>
            </Button>
          )
        ) : null}
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={isActing}
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {isLogoutPending ? "Signing out..." : "Sign out"}
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-center"
          disabled={isActing}
          onClick={onDisconnectGitHub}
        >
          <FolderGit2 className="h-4 w-4" aria-hidden="true" />
          {isUnlinkPending ? "Disconnecting..." : "Disconnect GitHub"}
        </Button>
      </div>
      {appInstallationBlocked ? (
        <p className="text-xs leading-5 text-rose-100">
          PR sync requires a GitHub App installation for your account. Install the app,
          then return here for automatic refresh.
        </p>
      ) : null}
      {appInstallationBlocked ? (
        <GitHubAppSyncBlockNotice message={appBlockMessage} showSettingsLink={false} />
      ) : null}
      <InlineNotice
        message={actionError || actionNotice}
        placeholder={actionError ? "Account action error" : "Account action status"}
        variant={actionError ? "error" : actionNoticeVariant}
        liveRole={actionError ? "alert" : "status"}
        minHeightClassName="min-h-7"
        onDismiss={actionError ? undefined : onDismissNotice}
        dismissLabel="Dismiss account status"
      />
    </GlowCard>
  );
}
