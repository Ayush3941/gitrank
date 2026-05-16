"use client";

import { useState } from "react";
import { Download, FolderGit2, LogOut, RefreshCcw, Sparkles, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PrivacyRepositoryToggleList } from "@/features/settings/components/PrivacyRepositoryToggleList";
import {
  useDeleteMyAccount,
  useExportMyAccountData,
  useLogoutSession,
  useRunInstallationSync,
  useRunRepositorySync,
  useQueueSyncRequest,
  useStartAccountLink,
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

type QueueSyncMode = "user" | "repository" | "pull_request" | "review" | "issue" | "commit";

export function SettingsPageClient() {
  const { data, isLoading, isError } = useMyProfile();
  const updatePrivacy = useUpdateProfilePrivacy();
  const updateRepositoryVisibility = useUpdateRepositoryVisibility();
  const requestSync = useRequestProfileSync();
  const unlinkAccount = useUnlinkMyAccount();
  const deleteAccount = useDeleteMyAccount();
  const exportAccount = useExportMyAccountData();
  const logoutSession = useLogoutSession();
  const accountLinkStart = useStartAccountLink();
  const queueSync = useQueueSyncRequest();
  const repositorySync = useRunRepositorySync();
  const installationSync = useRunInstallationSync();
  const { setReducedGamification } = useGamificationPreference();
  useAccountGamificationPreference(data);
  const [actionNotice, setActionNotice] = useState("");
  const [repositoryTarget, setRepositoryTarget] = useState("");
  const [installationTarget, setInstallationTarget] = useState("");
  const [queueMode, setQueueMode] = useState<QueueSyncMode>("user");
  const [queueUser, setQueueUser] = useState("");
  const [queueRepository, setQueueRepository] = useState("");
  const [queueNumber, setQueueNumber] = useState("");
  const [queueSha, setQueueSha] = useState("");
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
    (logoutSession.error as Error | null)?.message ||
    (unlinkAccount.error as Error | null)?.message ||
    (deleteAccount.error as Error | null)?.message ||
    (exportAccount.error as Error | null)?.message ||
    (accountLinkStart.error as Error | null)?.message ||
    (queueSync.error as Error | null)?.message ||
    (repositorySync.error as Error | null)?.message ||
    (installationSync.error as Error | null)?.message ||
    "";
  const isSaving = updatePrivacy.isPending || updateRepositoryVisibility.isPending;
  const isActing =
    requestSync.isPending ||
    logoutSession.isPending ||
    unlinkAccount.isPending ||
    deleteAccount.isPending ||
    exportAccount.isPending ||
    accountLinkStart.isPending ||
    queueSync.isPending ||
    repositorySync.isPending ||
    installationSync.isPending;
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

  function handleRepositorySyncExecution() {
    if (isActing) {
      return;
    }
    const target = repositoryTarget.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(target)) {
      setActionNotice("Repository sync target must be owner/repo.");
      return;
    }

    setActionNotice("");
    repositorySync.mutate(target, {
      onSuccess: (result) => {
        setActionNotice(
          `Repository sync completed for ${result.repository || target} at ${new Date(
            result.finished_at,
          ).toLocaleString()}.`,
        );
      },
    });
  }

  function handleQueueSyncRequest() {
    if (isActing) {
      return;
    }

    const mode = queueMode;
    const payload: {
      mode: QueueSyncMode;
      user?: string;
      repository?: string;
      number?: number;
      sha?: string;
    } = { mode };

    if (mode === "user") {
      const user = queueUser.trim();
      if (user.length > 0) {
        payload.user = user;
      }
    }

    if (mode === "repository" || mode === "pull_request" || mode === "review" || mode === "issue" || mode === "commit") {
      const repository = queueRepository.trim();
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
        setActionNotice("Target repository must be owner/repository.");
        return;
      }
      payload.repository = repository;
    }

    if (mode === "pull_request" || mode === "review" || mode === "issue") {
      const number = Number.parseInt(queueNumber.trim(), 10);
      if (!Number.isFinite(number) || number <= 0) {
        setActionNotice("PR, review, and issue queue modes require a positive number.");
        return;
      }
      payload.number = number;
    }

    if (mode === "commit") {
      const sha = queueSha.trim();
      if (!/^[A-Fa-f0-9]{6,64}$/.test(sha)) {
        setActionNotice("Commit sync requires a 6-64 character hexadecimal SHA.");
        return;
      }
      payload.sha = sha;
    }

    setActionNotice("");
    queueSync.mutate(payload, {
      onSuccess: (result) => {
        const acceptedAt = new Date(result.accepted_at).toLocaleString();
        const correlation = result.correlation_id ? ` (${result.correlation_id})` : "";
        setActionNotice(`Queued ${mode} sync at ${acceptedAt}${correlation}.`);
      },
    });
  }

  function handleInstallationSyncExecution() {
    if (isActing) {
      return;
    }
    const value = installationTarget.trim();
    const installationID = Number.parseInt(value, 10);
    if (!Number.isFinite(installationID) || installationID <= 0) {
      setActionNotice("Installation sync requires a positive installation ID.");
      return;
    }

    setActionNotice("");
    installationSync.mutate(installationID, {
      onSuccess: (result) => {
        setActionNotice(
          `Installation sync ${result.installation || installationID} completed at ${new Date(
            result.finished_at,
          ).toLocaleString()}.`,
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

  function handleAccountRelink() {
    if (isActing) {
      return;
    }
    setActionNotice("");
    accountLinkStart.mutate("/dashboard/settings", {
      onSuccess: (result) => {
        if (!result.authorize_url) {
          setActionNotice("Account relink response did not include authorize_url.");
          return;
        }
        window.location.assign(result.authorize_url);
      },
    });
  }

  function handleSessionLogout() {
    if (isActing) {
      return;
    }
    setActionNotice("");
    logoutSession.mutate(undefined, {
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
          <Button variant="secondary" disabled={isActing} onClick={handleAccountRelink}>
            <FolderGit2 className="h-4 w-4" />
            {accountLinkStart.isPending ? "Starting relink..." : "Reconnect GitHub"}
          </Button>
          <Button variant="secondary" disabled={isActing} onClick={handleSessionLogout}>
            <LogOut className="h-4 w-4" />
            {logoutSession.isPending ? "Signing out..." : "Sign out"}
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

      <GlowCard className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Queue targeted sync</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Queue user, repo, PR, review, issue, or commit jobs</h2>
          <p className="mt-2 text-sm text-muted">
            Uses the generic sync queue endpoint and enforces the same mode validation required by backend contracts.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="queue-mode">
              Sync mode
            </label>
            <Select value={queueMode} onValueChange={(value) => setQueueMode(value as QueueSyncMode)}>
              <SelectTrigger id="queue-mode" aria-label="Queue sync mode">
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="repository">repository</SelectItem>
                <SelectItem value="pull_request">pull_request</SelectItem>
                <SelectItem value="review">review</SelectItem>
                <SelectItem value="issue">issue</SelectItem>
                <SelectItem value="commit">commit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {queueMode === "user" ? (
            <div className="space-y-2">
              <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="queue-user">
                GitHub login (optional)
              </label>
              <Input
                id="queue-user"
                value={queueUser}
                onChange={(event) => setQueueUser(event.target.value)}
                placeholder="octocat"
                disabled={isActing}
              />
            </div>
          ) : null}

          {queueMode !== "user" ? (
            <div className="space-y-2">
              <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="queue-repository">
                Repository
              </label>
              <Input
                id="queue-repository"
                value={queueRepository}
                onChange={(event) => setQueueRepository(event.target.value)}
                placeholder="owner/repository"
                disabled={isActing}
              />
            </div>
          ) : null}

          {queueMode === "pull_request" || queueMode === "review" || queueMode === "issue" ? (
            <div className="space-y-2">
              <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="queue-number">
                Number
              </label>
              <Input
                id="queue-number"
                value={queueNumber}
                onChange={(event) => setQueueNumber(event.target.value)}
                placeholder="123"
                disabled={isActing}
              />
            </div>
          ) : null}

          {queueMode === "commit" ? (
            <div className="space-y-2">
              <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="queue-sha">
                Commit SHA
              </label>
              <Input
                id="queue-sha"
                value={queueSha}
                onChange={(event) => setQueueSha(event.target.value)}
                placeholder="a1b2c3d4..."
                disabled={isActing}
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={isActing} onClick={handleQueueSyncRequest}>
            {queueSync.isPending ? "Queueing targeted sync..." : "Queue targeted sync"}
          </Button>
          {queueSync.data ? (
            <p className="text-xs text-slate-300">
              {queueSync.data.status} • {queueSync.data.job_id ? `job ${queueSync.data.job_id}` : "job pending"} •{" "}
              {new Date(queueSync.data.accepted_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      </GlowCard>

      <GlowCard className="space-y-4">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Advanced sync execution</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Run repository or installation sync now</h2>
          <p className="mt-2 text-sm text-muted">
            Executes backend sync routes directly and returns fetched/persisted counts from the run.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3 rounded-[1.5rem] border border-primary/16 bg-primary/5 p-4">
            <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="sync-repository">
              Repository target
            </label>
            <Input
              id="sync-repository"
              value={repositoryTarget}
              onChange={(event) => setRepositoryTarget(event.target.value)}
              placeholder="owner/repository"
              disabled={isActing}
            />
            <Button disabled={isActing} onClick={handleRepositorySyncExecution}>
              {repositorySync.isPending ? "Running repository sync..." : "Run repository sync"}
            </Button>
            {repositorySync.data ? (
              <p className="text-xs text-slate-300">
                {repositorySync.data.mode} • {repositorySync.data.status} • fetched{" "}
                {formatCountMap(repositorySync.data.fetched)} • persisted{" "}
                {formatCountMap(repositorySync.data.persisted)}
              </p>
            ) : null}
          </div>
          <div className="space-y-3 rounded-[1.5rem] border border-primary/16 bg-primary/5 p-4">
            <label className="text-xs tracking-[0.2em] text-primary uppercase" htmlFor="sync-installation">
              Installation ID
            </label>
            <Input
              id="sync-installation"
              value={installationTarget}
              onChange={(event) => setInstallationTarget(event.target.value)}
              placeholder="12345678"
              disabled={isActing}
            />
            <Button disabled={isActing} onClick={handleInstallationSyncExecution}>
              {installationSync.isPending ? "Running installation sync..." : "Run installation sync"}
            </Button>
            {installationSync.data ? (
              <p className="text-xs text-slate-300">
                {installationSync.data.mode} • {installationSync.data.status} • fetched{" "}
                {formatCountMap(installationSync.data.fetched)} • persisted{" "}
                {formatCountMap(installationSync.data.persisted)}
              </p>
            ) : null}
          </div>
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
          <div key={label} className="neon-surface flex items-center justify-between gap-4 rounded-[1.75rem] px-4 py-4">
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

function formatCountMap(value?: Record<string, number>): string {
  if (!value || Object.keys(value).length === 0) {
    return "0";
  }
  return Object.entries(value)
    .map(([key, count]) => `${key}:${count}`)
    .join(", ");
}
