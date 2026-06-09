import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsAccountCard } from "@/features/settings/components/SettingsAccountCard";
import { SettingsDataControlsCard } from "@/features/settings/components/SettingsDataControlsCard";
import type { SyncStatus } from "@/types/gitrank";

const syncStatus: SyncStatus = {
  state: "synced",
  progress: 100,
  partialProfileAvailable: false,
};

describe("settings action buttons", () => {
  it("marks pending account actions as busy with concise labels", () => {
    render(
      <SettingsAccountCard
        username="octocat"
        syncStatus={syncStatus}
        displaySyncState="synced"
        appInstallationBlocked={false}
        actionError=""
        actionNotice=""
        actionNoticeVariant="info"
        isActing={true}
        isFetchingProfile={false}
        isUserSyncPending={true}
        isRelinkPending={true}
        isLogoutPending={true}
        isUnlinkPending={true}
        onRefreshProfile={vi.fn()}
        onReconnectGitHub={vi.fn()}
        onSignOut={vi.fn()}
        onDisconnectGitHub={vi.fn()}
        onDismissNotice={vi.fn()}
      />,
    );

    for (const name of [
      "Refreshing profile",
      "Starting relink",
      "Signing out",
      "Disconnecting",
    ]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-busy")).toBe("true");
    }
  });

  it("marks pending data actions as busy with concise labels", () => {
    render(
      <SettingsDataControlsCard
        isActing={true}
        isExportPending={true}
        isDeletePending={true}
        onExportAccountData={vi.fn()}
        onDeleteAccount={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Exporting data" }).getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Deleting account" }).getAttribute("aria-busy")).toBe(
      "true",
    );
  });
});
