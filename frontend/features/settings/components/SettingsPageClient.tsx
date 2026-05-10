"use client";

import { useState } from "react";
import { Download, FolderGit2, RefreshCcw, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PrivacyRepositoryToggleList } from "@/features/settings/components/PrivacyRepositoryToggleList";
import {
  useDeleteMyAccount,
  useRequestProfileSync,
  useUnlinkMyAccount,
} from "@/hooks/use-account-actions";
import {
  useMyProfile,
  useUpdateProfilePrivacy,
  useUpdateRepositoryVisibility,
} from "@/hooks/use-profile";
import type { PreviewMode, PrivacySettings } from "@/types/gitrank";

type BackedPrivacyKey =
  | "publicProfileEnabled"
  | "showExactPRs"
  | "showAiSummaries"
  | "showLeaderboardParticipation";

export function SettingsPageClient({ preview }: { preview?: PreviewMode }) {
  const { data, isLoading, isError } = useMyProfile(preview);
  const updatePrivacy = useUpdateProfilePrivacy();
  const updateRepositoryVisibility = useUpdateRepositoryVisibility();
  const requestSync = useRequestProfileSync();
  const unlinkAccount = useUnlinkMyAccount();
  const deleteAccount = useDeleteMyAccount();
  const isPreview = Boolean(preview);
  const [previewSettings, setPreviewSettings] = useState<PrivacySettings | null>(null);
  const [actionNotice, setActionNotice] = useState("");
  const currentSettings = isPreview ? previewSettings ?? data?.user.privacy ?? null : data?.user.privacy ?? null;

  if (isLoading) {
    return <LoadingState message="Checking privacy controls..." />;
  }

  if (isError || !data || !currentSettings) {
    return (
      <ErrorState
        title="Settings unavailable"
        description="Profile settings could not be loaded. Retry the sync or keep using the last verified profile."
      />
    );
  }

  const baselinePrivacy = data.user.privacy;
  const mutationError =
    (updatePrivacy.error as Error | null)?.message ||
    (updateRepositoryVisibility.error as Error | null)?.message ||
    "";
  const actionError =
    (requestSync.error as Error | null)?.message ||
    (unlinkAccount.error as Error | null)?.message ||
    (deleteAccount.error as Error | null)?.message ||
    "";
  const isSaving = updatePrivacy.isPending || updateRepositoryVisibility.isPending;
  const isActing = requestSync.isPending || unlinkAccount.isPending || deleteAccount.isPending;
  const pendingRepository = updateRepositoryVisibility.variables?.fullName ?? null;

  function handlePrivacyToggle(key: BackedPrivacyKey, checked: boolean) {
    if (isPreview) {
      setPreviewSettings((current) => ({
        ...(current ?? baselinePrivacy),
        [key]: checked,
      }));
      return;
    }
    updatePrivacy.mutate({ [key]: checked });
  }

  function handleSyncRequest() {
    if (isPreview) {
      return;
    }
    setActionNotice("");
    requestSync.mutate(undefined, {
      onSuccess: (result) => {
        const acceptedAt = new Date(result.accepted_at).toLocaleString();
        setActionNotice(
          `Sync queued at ${acceptedAt}. The latest verified snapshot stays visible until the refresh finishes.`,
        );
      },
    });
  }

  function handleUnlinkAccount() {
    if (isPreview || isActing) {
      return;
    }
    if (!window.confirm("Disconnect GitHub and sign out of this GitRank session?")) {
      return;
    }
    setActionNotice("");
    unlinkAccount.mutate(undefined, {
      onSuccess: () => {
        window.location.assign("/login");
      },
    });
  }

  function handleDeleteAccount() {
    if (isPreview || isActing) {
      return;
    }
    if (
      !window.confirm(
        "Delete this GitRank account? This removes your user-owned profile, score, badge, and session data from GitRank.",
      )
    ) {
      return;
    }
    setActionNotice("");
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        window.location.assign("/");
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings and privacy"
        description="Choose what becomes public, which repositories stay visible, and how much of your GitRank profile is shared."
      />
      <GlowCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">GitHub account</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">@{data.user.username}</h2>
          </div>
          <SyncStatusPill status={data.user.syncStatus} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={isPreview || isActing} onClick={handleSyncRequest}>
            <RefreshCcw className="h-4 w-4" />
            {requestSync.isPending ? "Queueing sync..." : "Sync now"}
          </Button>
          <Button variant="secondary" disabled={isPreview || isActing} onClick={handleUnlinkAccount}>
            <FolderGit2 className="h-4 w-4" />
            {unlinkAccount.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
        <p className="text-sm text-muted">
          Profile privacy controls, sync, disconnect, and deletion are live. Export remains pending in this frontend.
        </p>
        {actionNotice ? <p className="text-sm text-sky-100">{actionNotice}</p> : null}
        {actionError ? <p className="text-sm text-rose-200">{actionError}</p> : null}
      </GlowCard>

      <SettingSection
        title="Public profile"
        saving={isSaving}
        disabled={isSaving}
        errorMessage={mutationError}
        rows={[
          ["Enable public profile", currentSettings.publicProfileEnabled, (checked) => handlePrivacyToggle("publicProfileEnabled", checked)],
          ["Show exact PRs", currentSettings.showExactPRs, (checked) => handlePrivacyToggle("showExactPRs", checked)],
          ["Show AI summaries", currentSettings.showAiSummaries, (checked) => handlePrivacyToggle("showAiSummaries", checked)],
          ["Show leaderboard participation", currentSettings.showLeaderboardParticipation, (checked) => handlePrivacyToggle("showLeaderboardParticipation", checked)],
        ]}
      />

      <GlowCard className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Repository privacy</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Choose what stays on your public card</h2>
        </div>
          <PrivacyRepositoryToggleList
          repositories={data.user.repositories}
          pendingRepository={isPreview ? null : pendingRepository}
          onToggle={
            isPreview
              ? undefined
              : (repository, checked) =>
                  updateRepositoryVisibility.mutate({
                    fullName: repository.name,
                    visibility: checked ? "Public" : "Hidden",
                    reason: repository.reason,
                  })
          }
        />
      </GlowCard>

      <GlowCard className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Data controls</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Refresh, export, or remove account data</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled={isPreview || isActing} onClick={handleSyncRequest}>
            <RefreshCcw className="h-4 w-4" />
            {requestSync.isPending ? "Queueing refresh..." : "Refresh analysis"}
          </Button>
          <Button variant="secondary" disabled><Download className="h-4 w-4" />Export data</Button>
          <Button variant="danger" disabled={isPreview || isActing} onClick={handleDeleteAccount}>
            <Trash2 className="h-4 w-4" />
            {deleteAccount.isPending ? "Deleting account..." : "Delete account"}
          </Button>
        </div>
      </GlowCard>
    </div>
  );
}

function SettingSection({
  title,
  rows,
  saving,
  disabled,
  errorMessage,
}: {
  title: string;
  rows: Array<[string, boolean, (checked: boolean) => void]>;
  saving?: boolean;
  disabled?: boolean;
  errorMessage?: string;
}) {
  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        {saving ? <p className="text-sm text-primary">Saving…</p> : null}
      </div>
      {errorMessage ? <p className="text-sm text-rose-200">{errorMessage}</p> : null}
      <div className="space-y-3">
        {rows.map(([label, checked, onCheckedChange]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/8 bg-white/5 px-4 py-4">
            <label className="text-sm text-slate-200" htmlFor={label}>
              {label}
            </label>
            <Switch id={label} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
          </div>
        ))}
      </div>
    </GlowCard>
  );
}
