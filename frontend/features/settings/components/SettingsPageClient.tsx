"use client";

import { useState } from "react";
import { Download, FolderGit2, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
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
  useExportMyAccountData,
  useRequestProfileSync,
  useUnlinkMyAccount,
} from "@/hooks/use-account-actions";
import {
  useMyProfile,
  useUpdateProfilePrivacy,
  useUpdateRepositoryVisibility,
} from "@/hooks/use-profile";
import {
  useAccountGamificationPreference,
  useGamificationPreference,
} from "@/hooks/use-gamification-preference";

type BackedPrivacyKey =
  | "publicProfileEnabled"
  | "showExactPRs"
  | "showAiSummaries"
  | "showLeaderboardParticipation"
  | "reducedGamification";

export function SettingsPageClient() {
  const { data, isLoading, isError } = useMyProfile();
  const updatePrivacy = useUpdateProfilePrivacy();
  const updateRepositoryVisibility = useUpdateRepositoryVisibility();
  const requestSync = useRequestProfileSync();
  const unlinkAccount = useUnlinkMyAccount();
  const deleteAccount = useDeleteMyAccount();
  const exportAccount = useExportMyAccountData();
  const { setReducedGamification } = useGamificationPreference();
  useAccountGamificationPreference(data);
  const [actionNotice, setActionNotice] = useState("");
  const currentSettings = data?.user.privacy ?? null;

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

  const mutationError =
    (updatePrivacy.error as Error | null)?.message ||
    (updateRepositoryVisibility.error as Error | null)?.message ||
    "";
  const actionError =
    (requestSync.error as Error | null)?.message ||
    (unlinkAccount.error as Error | null)?.message ||
    (deleteAccount.error as Error | null)?.message ||
    (exportAccount.error as Error | null)?.message ||
    "";
  const isSaving = updatePrivacy.isPending || updateRepositoryVisibility.isPending;
  const isActing = requestSync.isPending || unlinkAccount.isPending || deleteAccount.isPending || exportAccount.isPending;
  const pendingRepository = updateRepositoryVisibility.variables?.fullName ?? null;

  function handlePrivacyToggle(key: BackedPrivacyKey, checked: boolean) {
    if (key === "reducedGamification") {
      setReducedGamification(checked);
    }
    updatePrivacy.mutate({ [key]: checked });
  }

  function handleSyncRequest() {
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
    if (isActing) {
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
    if (isActing) {
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

  function handleExportAccountData() {
    if (isActing) {
      return;
    }
    setActionNotice("");
    exportAccount.mutate(undefined, {
      onSuccess: (payload) => {
        const generatedAt = new Date(payload.generated_at);
        const exportDate = Number.isNaN(generatedAt.getTime())
          ? new Date().toISOString().slice(0, 10)
          : generatedAt.toISOString().slice(0, 10);
        const handle = data?.user.username || payload.user.public_handle || "account";
        downloadJSON(payload, `gitrank-account-export-${handle}-${exportDate}.json`);
        setActionNotice("Account export generated. Token secrets and secret hashes are excluded from the file.");
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
          <Button disabled={isActing} onClick={handleSyncRequest}>
            <RefreshCcw className="h-4 w-4" />
            {requestSync.isPending ? "Queueing sync..." : "Sync now"}
          </Button>
          <Button variant="secondary" disabled={isActing} onClick={handleUnlinkAccount}>
            <FolderGit2 className="h-4 w-4" />
            {unlinkAccount.isPending ? "Disconnecting..." : "Disconnect"}
          </Button>
        </div>
        <p className="text-sm text-muted">
          Profile privacy controls, sync, export, disconnect, and deletion are live. Export excludes token secrets and secret hashes.
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs tracking-[0.24em] text-primary uppercase">Display preference</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Reduced gamification</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Lowers animated XP ticks, badge shimmer, glow intensity, and rank effects for this account. Scores,
              badges, leaderboard placement, and privacy visibility do not change.
            </p>
          </div>
          <Switch
            id="reduced-gamification"
            checked={currentSettings.reducedGamification}
            disabled={isSaving}
            onCheckedChange={(checked) => handlePrivacyToggle("reducedGamification", checked)}
          />
        </div>
      </GlowCard>

      <GlowCard className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Repository privacy</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Choose what stays on your public card</h2>
        </div>
        <PrivacyRepositoryToggleList
          repositories={data.user.repositories}
          pendingRepository={pendingRepository}
          onToggle={
            (repository, checked) =>
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
          <Button disabled={isActing} onClick={handleSyncRequest}>
            <RefreshCcw className="h-4 w-4" />
            {requestSync.isPending ? "Queueing refresh..." : "Refresh analysis"}
          </Button>
          <Button variant="secondary" disabled={isActing} onClick={handleExportAccountData}>
            <Download className="h-4 w-4" />
            {exportAccount.isPending ? "Exporting..." : "Export data"}
          </Button>
          <Button variant="danger" disabled={isActing} onClick={handleDeleteAccount}>
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

function downloadJSON(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
