"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Download, FolderGit2, LogOut, Palette, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useDeleteMyAccount,
  useExportMyAccountData,
  useLogoutSession,
  useStartAccountLink,
  useUnlinkMyAccount,
} from "@/hooks/use-account-actions";
import {
  useMyProfile,
  useUpdateProfilePrivacy,
  useUpdateRepositoryVisibility,
} from "@/hooks/use-profile";
import { useSyncRuns } from "@/hooks/use-sync-runs";
import {
  useAccountGamificationPreference,
  useGamificationPreference,
} from "@/hooks/use-gamification-preference";
import {
  useDisplayShortcutsEnabled,
} from "@/hooks/use-display-shortcuts-enabled";
import { syncRunStatusLabel } from "@/features/settings/lib/sync-run-status";
import {
  type TextScalePreference,
  useTextScalePreference,
} from "@/hooks/use-text-scale-preference";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { type ThemePreference, useThemePreference } from "@/hooks/use-theme-preference";

type BackedPrivacyKey =
  | "publicProfileEnabled"
  | "showExactPRs"
  | "showAiSummaries"
  | "showLeaderboardParticipation"
  | "reducedGamification";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  swatchClassName: string;
}> = [
  {
    value: "neon",
    label: "Neon grid",
    description: "Bold cyberpunk glow and vivid HUD accents.",
    swatchClassName: "from-cyan-300 via-fuchsia-300 to-emerald-300",
  },
  {
    value: "cyberpunk",
    label: "Cyberpunk matrix",
    description: "Deep-pink highlights, amber rails, and low-noise dark steel surfaces.",
    swatchClassName: "from-pink-300 via-orange-300 to-lime-300",
  },
  {
    value: "midnight",
    label: "Midnight contrast",
    description: "Balanced readability with cleaner dark surfaces.",
    swatchClassName: "from-sky-300 via-indigo-300 to-violet-300",
  },
  {
    value: "terminal",
    label: "Terminal pulse",
    description: "Sharper terminal-style contrast with contained neon accents.",
    swatchClassName: "from-emerald-200 via-teal-200 to-fuchsia-300",
  },
  {
    value: "aurora",
    label: "Aurora clarity",
    description: "Softer glow with stronger body-copy contrast for long reading.",
    swatchClassName: "from-teal-200 via-cyan-200 to-blue-300",
  },
  {
    value: "high-contrast",
    label: "High contrast",
    description: "Maximum text clarity and reduced background noise.",
    swatchClassName: "from-slate-100 via-cyan-200 to-slate-100",
  },
];

const TEXT_SCALE_OPTIONS: Array<{
  value: TextScalePreference;
  label: string;
  description: string;
}> = [
  {
    value: "default",
    label: "Default text",
    description: "Balanced density with the standard UI scale.",
  },
  {
    value: "large",
    label: "Large text",
    description: "Increases body and UI copy size for easier reading.",
  },
];

const PrivacyRepositoryToggleList = dynamic(
  () =>
    import("@/features/settings/components/PrivacyRepositoryToggleList").then(
      (mod) => mod.PrivacyRepositoryToggleList,
    ),
  {
    loading: () => <SettingsPanelPlaceholder label="Loading repository visibility controls" />,
  },
);

const SyncRunActivityPanel = dynamic(
  () =>
    import("@/features/settings/components/SyncRunActivityPanel").then(
      (mod) => mod.SyncRunActivityPanel,
    ),
  {
    loading: () => <SettingsPanelPlaceholder label="Loading sync activity" />,
  },
);

export function SettingsPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useMyProfile();
  const updatePrivacy = useUpdateProfilePrivacy();
  const updateRepositoryVisibility = useUpdateRepositoryVisibility();
  const unlinkAccount = useUnlinkMyAccount();
  const deleteAccount = useDeleteMyAccount();
  const exportAccount = useExportMyAccountData();
  const logoutSession = useLogoutSession();
  const accountLinkStart = useStartAccountLink();
  const { setReducedGamification } = useGamificationPreference();
  const { theme, themeSource, setTheme, clearThemePreference } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const { enabled: displayShortcutsEnabled, setEnabled: setDisplayShortcutsEnabled } =
    useDisplayShortcutsEnabled();
  useAccountGamificationPreference(data);
  const [actionNotice, setActionNotice] = useState("");
  const [displayNotice, setDisplayNotice] = useState("");
  const currentSettings = data?.user.privacy ?? null;

  function handleResetDisplayPreferences() {
    clearThemePreference();
    setTextScale("default");
    setDisplayNotice(
      "Display preferences reset. Theme now follows your system high-contrast setting and text scale is Default.",
    );
  }

  if (isLoading) {
    return <LoadingState message="Checking privacy controls..." />;
  }

  if (isError || !data || !currentSettings) {
    return (
      <ErrorState
        title="Settings unavailable"
        description="Profile settings could not be loaded. Keep using the last verified profile and retry shortly."
        onRetry={() => {
          void refetch();
        }}
        fallbackLabel="Back to dashboard"
        fallbackHref="/dashboard"
        analyticsTarget="settings:error"
      />
    );
  }

  const mutationError = sanitizeUserFacingError(
    (updatePrivacy.error as Error | null)?.message ||
      (updateRepositoryVisibility.error as Error | null)?.message ||
      "",
    "settings-privacy",
  );
  const actionError = sanitizeUserFacingError(
    (logoutSession.error as Error | null)?.message ||
      (unlinkAccount.error as Error | null)?.message ||
      (deleteAccount.error as Error | null)?.message ||
      (exportAccount.error as Error | null)?.message ||
      (accountLinkStart.error as Error | null)?.message ||
      "",
    "settings-account-actions",
  );
  const isSaving = updatePrivacy.isPending || updateRepositoryVisibility.isPending;
  const isActing =
    logoutSession.isPending ||
    unlinkAccount.isPending ||
    deleteAccount.isPending ||
    exportAccount.isPending ||
    accountLinkStart.isPending;
  const pendingRepository = updateRepositoryVisibility.variables?.fullName ?? null;
  const hiddenRepositoryCount = data.user.repositories.filter((repository) => repository.visibility !== "Public").length;
  const accountActionNoticeId = "settings-account-action-notice";
  const accountActionErrorId = "settings-account-action-error";

  function handlePrivacyToggle(key: BackedPrivacyKey, checked: boolean) {
    if (key === "reducedGamification") {
      setReducedGamification(checked);
    }
    updatePrivacy.mutate({ [key]: checked });
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
        eyebrow="Settings"
        title="Settings"
        description="Account, privacy, and display controls."
        actions={(
          <Button asChild variant="secondary" size="sm">
            <Link href={`/u/${data.user.username}`} prefetch={false}>
              View public profile
            </Link>
          </Button>
        )}
      />
      <section>
        <GlowCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">GitHub account</p>
            <h2 className="mt-2 text-xl font-semibold text-white">@{data.user.username}</h2>
          </div>
          <SyncStatusPill status={data.user.syncStatus} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={isActing || isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {isFetching ? "Refreshing view..." : "Refresh profile view"}
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
        <div className="min-h-6">
          {actionError ? (
            <p id={accountActionErrorId} role="alert" className="text-sm text-rose-200">
              {actionError}
            </p>
          ) : actionNotice ? (
            <p id={accountActionNoticeId} role="status" aria-live="polite" className="text-sm text-sky-100">
              {actionNotice}
            </p>
          ) : (
            <p aria-hidden="true" className="text-sm opacity-0 select-none">
              Account action status
            </p>
          )}
        </div>
        </GlowCard>
      </section>

      <section className="render-opt-section">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Sync activity</h2>
          <div id="settings-sync-activity-panel">
            <SettingsSyncActivitySection />
          </div>
        </div>
      </section>

      <section className="render-opt-section">
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
      </section>

      <section className="render-opt-section">
        <GlowCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="mt-4 text-xs font-medium text-primary">Display preference</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Reduced gamification</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Reduces heavy visual effects. Scores and privacy stay unchanged.
              </p>
            </div>
            <Switch
              id="reduced-gamification"
              aria-label="Reduced gamification"
              checked={currentSettings.reducedGamification}
              disabled={isSaving}
              onCheckedChange={(checked) => handlePrivacyToggle("reducedGamification", checked)}
            />
          </div>
            <div className="cyber-divider" />
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-xs font-medium text-primary">Keyboard controls</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Display shortcuts</h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Enables theme and text-size shortcuts outside input fields.
                </p>
              </div>
              <Switch
                id="display-shortcuts-enabled"
                aria-label="Enable display shortcuts"
                checked={displayShortcutsEnabled}
                onCheckedChange={setDisplayShortcutsEnabled}
              />
            </div>
            <div className="cyber-divider" />
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-white">Theme + text tuning</p>
              </div>
              <div id="display-tuning-controls" className="space-y-4">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-primary">Visual theme</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {THEME_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={theme === option.value ? "default" : "secondary"}
                        className="h-auto justify-between px-4 py-3 text-left"
                        onClick={() => setTheme(option.value)}
                        aria-pressed={theme === option.value}
                      >
                        <span className="flex flex-col items-start gap-1">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`h-2.5 w-5 rounded-full bg-gradient-to-r ${option.swatchClassName}`}
                              aria-hidden="true"
                            />
                            <span>{option.label}</span>
                          </span>
                          <span className="text-xs text-muted">{option.description}</span>
                        </span>
                        {theme === option.value ? (
                          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-xs font-semibold text-emerald-50">
                            Active
                          </span>
                        ) : null}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="justify-start"
                    onClick={clearThemePreference}
                    disabled={themeSource === "system"}
                  >
                    {themeSource === "system" ? "Following system theme" : "Follow system theme"}
                  </Button>
                </div>
                <div className="cyber-divider" />
                <div className="space-y-3">
                  <p className="text-xs font-medium text-primary">Text scale</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {TEXT_SCALE_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={textScale === option.value ? "default" : "secondary"}
                        className="h-auto justify-between px-4 py-3 text-left"
                        onClick={() => setTextScale(option.value)}
                        aria-pressed={textScale === option.value}
                      >
                        <span className="flex flex-col items-start">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted">{option.description}</span>
                        </span>
                        {textScale === option.value ? (
                          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-xs font-semibold text-emerald-50">
                            Active
                          </span>
                        ) : null}
                      </Button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="justify-start"
                    onClick={handleResetDisplayPreferences}
                  >
                    Reset display preferences
                  </Button>
                </div>
              </div>
            </div>
            {displayNotice ? (
              <p role="status" aria-live="polite" className="text-sm text-cyan-100">
                {displayNotice}
              </p>
            ) : null}
          </div>
        </GlowCard>
      </section>

      <section className="render-opt-section">
        <GlowCard className="space-y-4">
          <div>
            <p className="text-xs font-medium text-primary">Repository privacy</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Repository visibility</h2>
          </div>
          <p className="text-sm text-muted">
            Repository visibility controls ({data.user.repositories.length} total{hiddenRepositoryCount > 0 ? ` · ${hiddenRepositoryCount} hidden` : ""})
          </p>
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
      </section>

      <section className="render-opt-section">
        <GlowCard className="space-y-4">
          <div>
            <p className="text-xs font-medium text-primary">Data controls</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Export or remove data</h2>
          </div>
          <div className="flex flex-wrap gap-3">
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
      </section>
    </div>
  );
}

function SettingsSyncActivitySection() {
  const syncRunsQuery = useSyncRuns(25);
  const syncRunsError = sanitizeUserFacingError(
    (syncRunsQuery.error as Error | null)?.message || "",
    "settings-sync-runs",
  );
  const runs = syncRunsQuery.data?.runs ?? [];
  const runningCount = runs.filter((run) => syncRunStatusLabel(run.status) === "Running").length;
  const failedCount = runs.filter((run) => syncRunStatusLabel(run.status) === "Failed").length;

  return (
    <GlowCard className="space-y-4">
      <div className="neon-surface flex flex-wrap items-center justify-between gap-3 rounded-[1rem] px-4 py-3">
        <p className="text-sm font-semibold text-white">
          Sync run log ({runs.length})
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Running {runningCount}</span>
          <span>Failed {failedCount}</span>
        </div>
      </div>
      <SyncRunActivityPanel
        runs={runs}
        lastUpdatedAt={syncRunsQuery.data?.last_updated_at}
        isLoading={syncRunsQuery.isLoading}
        isRefreshing={syncRunsQuery.isFetching}
        isError={syncRunsQuery.isError}
        errorMessage={syncRunsError}
        onRefresh={() => {
          void syncRunsQuery.refetch();
        }}
      />
    </GlowCard>
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
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {saving ? <p className="text-sm text-primary">Saving…</p> : null}
      </div>
      {errorMessage ? (
        <p id={`${toControlID(title)}-error`} role="alert" className="text-sm text-rose-200">
          {errorMessage}
        </p>
      ) : null}
      <ul className="space-y-3">
        {rows.map(([label, checked, onCheckedChange], index) => {
          const controlID = `${toControlID(title)}-${toControlID(label)}-${index}`;
          return (
          <li key={`${label}-${index}`} className="list-none neon-surface flex items-center justify-between gap-4 rounded-[1.75rem] px-4 py-4">
            <label className="text-sm text-muted" htmlFor={controlID}>
              {label}
            </label>
            <Switch
              id={controlID}
              checked={checked}
              disabled={disabled}
              onCheckedChange={onCheckedChange}
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? `${toControlID(title)}-error` : undefined}
            />
          </li>
          );
        })}
      </ul>
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

function toControlID(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SettingsPanelPlaceholder({ label }: { label: string }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-9 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
    </div>
  );
}
