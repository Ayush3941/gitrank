"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Download, FolderGit2, LogOut, Palette, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
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
  useNetworkConstraintReason,
} from "@/hooks/use-gamification-preference";
import {
  useDisplayShortcutsEnabled,
} from "@/hooks/use-display-shortcuts-enabled";
import {
  type TextScalePreference,
  useTextScalePreference,
} from "@/hooks/use-text-scale-preference";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
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
    description: "Bold glow and vivid HUD accents.",
    swatchClassName: "from-cyan-300 via-fuchsia-300 to-emerald-300",
  },
  {
    value: "cyberpunk",
    label: "Cyberpunk matrix",
    description: "Pink highlights, amber rails, dark steel surfaces.",
    swatchClassName: "from-pink-300 via-orange-300 to-lime-300",
  },
  {
    value: "midnight",
    label: "Midnight contrast",
    description: "Balanced readability on dark surfaces.",
    swatchClassName: "from-sky-300 via-indigo-300 to-violet-300",
  },
  {
    value: "terminal",
    label: "Terminal pulse",
    description: "Sharper terminal-style contrast.",
    swatchClassName: "from-emerald-200 via-teal-200 to-fuchsia-300",
  },
  {
    value: "aurora",
    label: "Aurora clarity",
    description: "Softer glow with stronger text contrast.",
    swatchClassName: "from-teal-200 via-cyan-200 to-blue-300",
  },
  {
    value: "high-contrast",
    label: "High contrast",
    description: "Maximum text clarity with low visual noise.",
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
    description: "Balanced density at standard UI scale.",
  },
  {
    value: "large",
    label: "Large text",
    description: "Larger body and UI text.",
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
  const networkConstraintReason = useNetworkConstraintReason();
  const { theme, themeSource, setTheme, clearThemePreference } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const { enabled: displayShortcutsEnabled, setEnabled: setDisplayShortcutsEnabled } =
    useDisplayShortcutsEnabled();
  useAccountGamificationPreference(data);
  const [actionNotice, setActionNotice] = useState("");
  const [displayNotice, setDisplayNotice] = useState("");
  const [showDisplayTuning, setShowDisplayTuning] = useState(false);
  const currentSettings = data?.user.privacy ?? null;
  const activeTheme = THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[0];
  const activeTextScale = TEXT_SCALE_OPTIONS.find((option) => option.value === textScale) ?? TEXT_SCALE_OPTIONS[0];

  useEffect(() => {
    if (!actionNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setActionNotice("");
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [actionNotice]);

  useEffect(() => {
    if (!displayNotice) {
      return;
    }
    const timer = window.setTimeout(() => {
      setDisplayNotice("");
    }, 4200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [displayNotice]);

  function handleResetDisplayPreferences() {
    clearThemePreference();
    setTextScale("default");
    setDisplayNotice(
      "Display preferences reset. Theme now follows your system theme preference and text scale is Default.",
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading settings..." />;
  }

  if (isError || !data || !currentSettings) {
    return (
      <ErrorState
        title="Settings unavailable"
        description="Could not load settings. Retry in a moment."
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
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Privacy, sync, and display controls."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `@${data.user.username}` },
              { label: `Repos ${data.user.repositories.length}` },
              { label: `Hidden ${hiddenRepositoryCount}` },
              {
                label: `Sync ${formatSyncStateLabel(data.user.syncStatus.state)}`,
                tone: toneForSyncState(data.user.syncStatus.state),
              },
              ...(networkConstraintReason
                ? [{ label: "Runtime Lite mode", tone: "info" as const }]
                : []),
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <SnapshotFreshnessPill refreshedAt={data.refreshedAt} label="Refreshed" />
            <Button asChild variant="secondary" size="sm">
              <Link href={`/u/${data.user.username}`} prefetch={false}>
                Public profile
              </Link>
            </Button>
          </div>
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
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button
            variant="secondary"
            className="w-full justify-center"
            disabled={isActing || isFetching}
            onClick={() => {
              void refetch();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            {isFetching ? "Refreshing..." : "Refresh snapshot"}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            disabled={isActing}
            onClick={handleAccountRelink}
          >
            <FolderGit2 className="h-4 w-4" />
            {accountLinkStart.isPending ? "Starting relink..." : "Reconnect GitHub"}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            disabled={isActing}
            onClick={handleSessionLogout}
          >
            <LogOut className="h-4 w-4" />
            {logoutSession.isPending ? "Signing out..." : "Sign out"}
          </Button>
          <Button
            variant="secondary"
            className="w-full justify-center"
            disabled={isActing}
            onClick={handleUnlinkAccount}
          >
            <FolderGit2 className="h-4 w-4" />
            {unlinkAccount.isPending ? "Disconnecting..." : "Disconnect GitHub"}
          </Button>
        </div>
        {actionError ? (
          <div className="min-h-6">
            <p id={accountActionErrorId} role="alert" className="inline-flex items-center rounded-[0.1rem] border border-rose-300/26 bg-rose-500/10 px-3 py-1.5 text-sm text-rose-100">
              {actionError}
            </p>
          </div>
        ) : (
          <InlineNotice
            message={actionNotice}
            placeholder="Account action status"
            variant="info"
            minHeightClassName="min-h-7"
            onDismiss={() => {
              setActionNotice("");
            }}
            dismissLabel="Dismiss account status"
          />
        )}
        </GlowCard>
      </section>

      <section className="render-opt-section" id="settings-sync-activity-panel">
        <SettingsSyncActivitySection />
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
                Reduce visual effects. Scores and privacy stay unchanged.
              </p>
              {networkConstraintReason ? (
                <p className="mt-2 text-xs text-muted">
                  Runtime Lite mode is active: {networkConstraintReasonLabel(networkConstraintReason)}.
                </p>
              ) : null}
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
                  Enable theme and text-size shortcuts outside text inputs.
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
              <div className="neon-surface rounded-[1rem] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    {activeTheme.label} · {activeTextScale.label} · {themeSource === "system" ? "System" : "Manual"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    aria-expanded={showDisplayTuning}
                    aria-controls="display-tuning-controls"
                    onClick={() => {
                      setShowDisplayTuning((current) => !current);
                    }}
                  >
                    {showDisplayTuning ? (
                      <>
                        Hide tuning
                        <ChevronUp className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Display tuning
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <div id="display-tuning-controls" className={showDisplayTuning ? "space-y-4" : "hidden"}>
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
            <InlineNotice
              message={displayNotice}
              placeholder="Display update"
              variant="info"
              minHeightClassName="min-h-7"
              onDismiss={() => {
                setDisplayNotice("");
              }}
              dismissLabel="Dismiss display update"
            />
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
            {data.user.repositories.length} repositories{hiddenRepositoryCount > 0 ? ` · ${hiddenRepositoryCount} hidden` : ""}
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
            <h2 className="mt-2 text-xl font-semibold text-white">Data export and deletion</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              variant="secondary"
              className="w-full justify-center"
              disabled={isActing}
              onClick={handleExportAccountData}
            >
              <Download className="h-4 w-4" />
              {exportAccount.isPending ? "Exporting..." : "Export data"}
            </Button>
          </div>
          <div className="space-y-2 rounded-[0.1rem] border border-rose-300/24 bg-rose-500/8 px-3 py-3">
            <p className="text-xs text-rose-100">Delete permanently removes profile, score, badges, and session data.</p>
            <Button
              variant="danger"
              className="w-full justify-center"
              disabled={isActing}
              onClick={handleDeleteAccount}
            >
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
  const syncRunsQuery = useSyncRuns(15);
  const syncRunsError = sanitizeUserFacingError(
    (syncRunsQuery.error as Error | null)?.message || "",
    "settings-sync-runs",
  );
  const runs = syncRunsQuery.data?.runs ?? [];

  return (
    <GlowCard className="space-y-4">
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
    <div className="min-h-[15rem] space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-9 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
    </div>
  );
}

function networkConstraintReasonLabel(
  reason:
    | "save-data"
    | "slow-connection"
    | "reduced-data-preference"
    | "low-device-memory"
    | "low-cpu-cores"
    | "slow-display-updates",
): string {
  if (reason === "save-data") {
    return "Save-Data preference";
  }
  if (reason === "slow-connection") {
    return "slow network connection";
  }
  if (reason === "reduced-data-preference") {
    return "reduced-data preference";
  }
  if (reason === "low-device-memory") {
    return "limited device memory";
  }
  if (reason === "low-cpu-cores") {
    return "limited CPU cores";
  }
  return "slow display update capability";
}
