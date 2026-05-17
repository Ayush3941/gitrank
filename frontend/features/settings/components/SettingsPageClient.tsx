"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, FolderGit2, LogOut, Palette, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { SyncStateGuide } from "@/components/shared/SyncStateGuide";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PrivacyRepositoryToggleList } from "@/features/settings/components/PrivacyRepositoryToggleList";
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
import {
  useAccountGamificationPreference,
  useGamificationPreference,
} from "@/hooks/use-gamification-preference";
import {
  useDisplayShortcutsEnabled,
} from "@/hooks/use-display-shortcuts-enabled";
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

type SettingsSectionID =
  | "settings-account"
  | "settings-public-profile"
  | "settings-display"
  | "settings-repositories"
  | "settings-data-controls";

const SETTINGS_SECTION_ITEMS: Array<{ id: SettingsSectionID; label: string }> = [
  { id: "settings-account", label: "Account" },
  { id: "settings-public-profile", label: "Privacy" },
  { id: "settings-display", label: "Display" },
  { id: "settings-repositories", label: "Repositories" },
  { id: "settings-data-controls", label: "Data" },
];

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
    value: "midnight",
    label: "Midnight contrast",
    description: "Balanced readability with cleaner dark surfaces.",
    swatchClassName: "from-sky-300 via-indigo-300 to-violet-300",
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
  const { theme, setTheme } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const { enabled: displayShortcutsEnabled, setEnabled: setDisplayShortcutsEnabled } =
    useDisplayShortcutsEnabled();
  useAccountGamificationPreference(data);
  const [actionNotice, setActionNotice] = useState("");
  const [displayNotice, setDisplayNotice] = useState("");
  const [activeSection, setActiveSection] = useState<SettingsSectionID>("settings-account");
  const currentSettings = data?.user.privacy ?? null;
  const activeThemeOption =
    THEME_OPTIONS.find((option) => option.value === theme) ?? THEME_OPTIONS[1];

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const id = visible.target.id as SettingsSectionID;
        if (id) {
          setActiveSection(id);
        }
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    SETTINGS_SECTION_ITEMS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => observer.disconnect();
  }, []);

  function handleResetDisplayPreferences() {
    setTheme("midnight");
    setTextScale("default");
    setDisplayNotice("Display preferences reset to Midnight theme and Default text size.");
  }

  if (isLoading) {
    return <LoadingState message="Checking privacy controls..." />;
  }

  if (isError || !data || !currentSettings) {
    return (
      <ErrorState
        title="Settings unavailable"
        description="Profile settings could not be loaded. Keep using the last verified profile and retry shortly."
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
        title="Settings and privacy"
        description="Choose what becomes public, which repositories stay visible, and how much of your GitRank profile is shared."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={`/u/${data.user.username}`}>View public profile</Link>
            </Button>
            <ShareProfileButton
              variant="ghost"
              size="sm"
              username={data.user.username}
              displayName={data.user.displayName}
              shareHeadline={`${data.user.displayName} is ${data.user.title} on GitRank.`}
              analyticsTargetPrefix="settings-profile"
            />
          </div>
        )}
      />
      <nav
        aria-labelledby="settings-jump-nav-label"
        className="glass-panel flex flex-wrap items-center gap-2 border border-primary/20 p-2 xl:sticky xl:top-20 xl:z-20"
      >
        <p id="settings-jump-nav-label" className="cyber-title px-2 text-[10px] tracking-[0.16em] text-cyan-200 uppercase">Jump to</p>
        <ul role="list" className="flex flex-wrap gap-2">
          {SETTINGS_SECTION_ITEMS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? "location" : undefined}
                className={
                  activeSection === section.id
                    ? "focus-ring cyber-title border border-primary/45 bg-primary/16 px-3 py-1.5 text-[11px] tracking-[0.16em] text-white uppercase"
                    : "focus-ring cyber-title border border-transparent px-3 py-1.5 text-[11px] tracking-[0.16em] text-slate-200 uppercase hover:border-primary/28 hover:bg-primary/10"
                }
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <section id="settings-account" className="scroll-mt-24">
        <GlowCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">GitHub account</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">@{data.user.username}</h2>
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
        <p className="text-sm text-muted">
          Automatic GitHub sync runs in the background when you open authenticated dashboard routes. Export excludes token secrets and secret hashes.
        </p>
        <SyncStateGuide status={data.user.syncStatus} />
        {actionNotice ? (
          <p id={accountActionNoticeId} role="status" aria-live="polite" className="text-sm text-sky-100">
            {actionNotice}
          </p>
        ) : null}
        {actionError ? (
          <p id={accountActionErrorId} role="alert" className="text-sm text-rose-200">
            {actionError}
          </p>
        ) : null}
        </GlowCard>
      </section>

      <section id="settings-public-profile" className="scroll-mt-24">
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

      <section id="settings-display" className="scroll-mt-24">
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
              badges, leaderboard placement, and privacy visibility do not change. It also disables heavy glass blur
              layers and background overlays for better performance on constrained devices. If no explicit preference is saved,
              GitRank follows your system reduced-motion or reduced-data preference.
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Keyboard controls</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Display shortcuts</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Enables global display shortcuts when focus is not in an editable field.
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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
              <Palette className="h-5 w-5" />
            </div>
            <p className="mt-4 text-xs tracking-[0.24em] text-primary uppercase">Visual theme</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Readable style mode</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Theme choice only changes visual treatment. Ranking, scoring, privacy, and sync behavior stay identical.
              If no explicit theme is stored, GitRank follows your system high-contrast preference.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:min-w-[18rem]">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={theme === option.value ? "default" : "secondary"}
                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                onClick={() => setTheme(option.value)}
              >
                <span className="neon-track h-8 w-10 shrink-0 overflow-hidden rounded-md border border-primary/30">
                  <span
                    className={`block h-full w-full bg-gradient-to-r ${option.swatchClassName}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="flex flex-col items-start">
                  <span className="inline-flex items-center gap-2">
                    {option.label}
                    {theme === option.value ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-[10px] tracking-[0.12em] text-emerald-50 uppercase">
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">{option.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>
        <div className="cyber-divider" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Text scale</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Readable text size</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              Choose a denser or larger text rendering mode. This affects frontend reading size only.
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-200">
              Keyboard shortcuts: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>T</kbd> toggles theme, and <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> toggles text size.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:w-auto sm:min-w-[18rem]">
            {TEXT_SCALE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={textScale === option.value ? "default" : "secondary"}
                className="h-auto justify-start px-4 py-3 text-left"
                onClick={() => setTextScale(option.value)}
              >
                <span className="flex flex-col items-start">
                  <span className="inline-flex items-center gap-2">
                    {option.label}
                    {textScale === option.value ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-300/18 px-2 py-0.5 text-[10px] tracking-[0.12em] text-emerald-50 uppercase">
                        Active
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">{option.description}</span>
                </span>
              </Button>
            ))}
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
        {displayNotice ? (
          <p role="status" aria-live="polite" className="text-sm text-cyan-100">
            {displayNotice}
          </p>
        ) : null}
        <div className="neon-surface-strong space-y-3 px-4 py-4">
          <p className="text-xs tracking-[0.2em] text-primary uppercase">Live readability preview</p>
          <h3 className="text-lg font-semibold text-white">
            GitRank highlights meaningful contribution quality clearly before style.
          </h3>
          <p className="text-sm leading-7 text-muted">
            Current theme:
            {" "}
            <span className="font-semibold text-foreground">{activeThemeOption.label}</span>
            {" "}
            ·
            {" "}
            {activeThemeOption.description}
          </p>
          <p className="text-sm leading-7 text-slate-200">
            Use this preview to confirm headings, supporting copy, and small labels stay easy to read on your screen.
          </p>
        </div>
        </GlowCard>
      </section>

      <section id="settings-repositories" className="scroll-mt-24">
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
      </section>

      <section id="settings-data-controls" className="scroll-mt-24">
        <GlowCard className="space-y-4">
          <div>
            <p className="text-xs tracking-[0.24em] text-primary uppercase">Data controls</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Export or remove account data</h2>
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
      {errorMessage ? (
        <p id={`${toControlID(title)}-error`} role="alert" className="text-sm text-rose-200">
          {errorMessage}
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.map(([label, checked, onCheckedChange], index) => {
          const controlID = `${toControlID(title)}-${toControlID(label)}-${index}`;
          return (
          <div key={label} className="neon-surface flex items-center justify-between gap-4 rounded-[1.75rem] px-4 py-4">
            <label className="text-sm text-slate-200" htmlFor={controlID}>
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
          </div>
          );
        })}
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

function toControlID(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
