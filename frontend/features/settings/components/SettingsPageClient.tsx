"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { Button } from "@/components/ui/button";
import {
  useDeleteMyAccount,
  useExportMyAccountData,
  useLogoutSession,
  useRunUserSync,
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
import { useProfileSyncState } from "@/hooks/use-profile-sync-state";
import {
  useTextScalePreference,
} from "@/hooks/use-text-scale-preference";
import {
  isGitHubAppInstallationBlocked,
  selectLatestActionableSyncRunOutcome,
} from "@/features/settings/lib/sync-run-diagnostics";
import { shouldShowProfileFreshnessPill } from "@/lib/presentation/sync-evidence";
import { formatSyncStateLabel, toneForSyncState } from "@/lib/presentation/status-tone";
import { buildUserSyncRefreshFeedback } from "@/lib/sync-refresh-feedback";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { SettingsAccountCard } from "@/features/settings/components/SettingsAccountCard";
import { SettingsDataControlsCard } from "@/features/settings/components/SettingsDataControlsCard";
import { SettingsDisplayPreferencesCard } from "@/features/settings/components/SettingsDisplayPreferencesCard";
import {
  SettingsPublicProfileCard,
  type SettingsPublicProfilePrivacyKey,
} from "@/features/settings/components/SettingsPublicProfileCard";
import { SettingsSyncActivitySection } from "@/features/settings/components/SettingsSyncActivitySection";

type BackedPrivacyKey = SettingsPublicProfilePrivacyKey | "reducedGamification";

const SETTINGS_SECTION_LINKS = [
  { id: "settings-account", label: "Account" },
  { id: "settings-sync-activity-panel", label: "Sync log" },
  { id: "settings-public-profile", label: "Privacy" },
  { id: "settings-display-preferences", label: "Display" },
  { id: "settings-repositories", label: "Repositories" },
  { id: "settings-data-controls", label: "Data" },
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

export function SettingsPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useMyProfile();
  const updatePrivacy = useUpdateProfilePrivacy();
  const updateRepositoryVisibility = useUpdateRepositoryVisibility();
  const unlinkAccount = useUnlinkMyAccount();
  const deleteAccount = useDeleteMyAccount();
  const exportAccount = useExportMyAccountData();
  const logoutSession = useLogoutSession();
  const accountLinkStart = useStartAccountLink();
  const runUserSync = useRunUserSync();
  const syncRunsQuery = useSyncRuns(15);
  const { setReducedGamification } = useGamificationPreference();
  const { theme, themeSource, setTheme, clearThemePreference } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const { enabled: displayShortcutsEnabled, setEnabled: setDisplayShortcutsEnabled } =
    useDisplayShortcutsEnabled();
  useAccountGamificationPreference(data);
  const [actionNotice, setActionNotice] = useState("");
  const [actionNoticeVariant, setActionNoticeVariant] = useState<"info" | "success" | "warning" | "error">("info");
  const profileUser = data?.user;
  const currentSettings = data?.user.privacy ?? null;
  const syncRuns = useMemo(
    () => syncRunsQuery.data?.runs ?? [],
    [syncRunsQuery.data?.runs],
  );
  const { syncStateForDisplay, showRefreshPill } = useProfileSyncState(
    profileUser,
    syncRuns,
  );
  const latestSyncOutcome = useMemo(
    () => selectLatestActionableSyncRunOutcome(syncRuns),
    [syncRuns],
  );
  const appInstallationBlocked = isGitHubAppInstallationBlocked(latestSyncOutcome);
  const displaySyncState = appInstallationBlocked ? "failed" : syncStateForDisplay;

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

  if (isLoading) {
    return (
      <RouteLoadingState
        eyebrow="Settings"
        title="Settings"
        description="Loading account, sync, privacy, and display controls."
        cardCount={3}
      />
    );
  }

  if (isError || !data || !currentSettings) {
    return (
      <ErrorState
        title="Settings unavailable"
        description="Settings are unavailable right now. Retry in a moment."
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
    (runUserSync.error as Error | null)?.message ||
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
    runUserSync.isPending ||
    unlinkAccount.isPending ||
    deleteAccount.isPending ||
    exportAccount.isPending ||
    accountLinkStart.isPending;
  const pendingRepository = updateRepositoryVisibility.variables?.fullName ?? null;
  const hiddenRepositoryCount = data.user.repositories.filter((repository) => repository.visibility !== "Public").length;
  const syncRunsError = sanitizeUserFacingError(
    (syncRunsQuery.error as Error | null)?.message || "",
    "settings-sync-runs",
  );

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
    setActionNoticeVariant("info");
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
    setActionNoticeVariant("info");
    accountLinkStart.mutate("/dashboard/settings", {
      onSuccess: (result) => {
        if (!result.authorize_url) {
          setActionNotice("Account relink response is missing authorize_url.");
          setActionNoticeVariant("warning");
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
    setActionNoticeVariant("info");
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
    setActionNoticeVariant("info");
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
    setActionNoticeVariant("info");
    exportAccount.mutate(undefined, {
      onSuccess: (payload) => {
        const generatedAt = new Date(payload.generated_at);
        const exportDate = Number.isNaN(generatedAt.getTime())
          ? new Date().toISOString().slice(0, 10)
          : generatedAt.toISOString().slice(0, 10);
        const handle = data?.user.username || payload.user.public_handle || "account";
        downloadJSON(payload, `gitrank-account-export-${handle}-${exportDate}.json`);
        setActionNotice("Account export generated. Token secrets and secret hashes are excluded from the file.");
        setActionNoticeVariant("success");
      },
    });
  }

  function handleRunProfileRefresh() {
    if (appInstallationBlocked || isActing || isFetching) {
      return;
    }
    setActionNotice("");
    setActionNoticeVariant("info");
    runUserSync.mutate(undefined, {
      onSuccess: (result) => {
        const feedback = buildUserSyncRefreshFeedback(result);
        setActionNotice(feedback.message);
        setActionNoticeVariant(
          feedback.tone === "success"
            ? "success"
            : feedback.tone === "error"
              ? "error"
              : "warning",
        );
        void refetch();
        void syncRunsQuery.refetch();
      },
    });
  }

  return (
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Settings"
        description="Privacy, sync, and display."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `@${data.user.username}` },
              {
                label: `Sync ${formatSyncStateLabel(displaySyncState)}`,
                tone: toneForSyncState(displaySyncState),
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <ProfileEvidenceStateChip
              showFreshness={shouldShowProfileFreshnessPill(showRefreshPill, displaySyncState, appInstallationBlocked)}
              refreshedAt={data.refreshedAt}
              syncState={displaySyncState}
            />
            <Button asChild variant="secondary" size="sm">
              <IntentPrefetchLink href={`/u/${data.user.username}`}>
                Public profile
              </IntentPrefetchLink>
            </Button>
          </div>
        )}
      />
      <InPageSectionNav sections={SETTINGS_SECTION_LINKS} className="render-opt-section" />
      <section id="settings-account" data-scroll-target="true">
        <SettingsAccountCard
          username={data.user.username}
          syncStatus={data.user.syncStatus}
          displaySyncState={displaySyncState}
          appInstallationBlocked={appInstallationBlocked}
          appBlockMessage={latestSyncOutcome?.message}
          actionError={actionError}
          actionNotice={actionNotice}
          actionNoticeVariant={actionNoticeVariant}
          isActing={isActing}
          isFetchingProfile={isFetching}
          isUserSyncPending={runUserSync.isPending}
          isRelinkPending={accountLinkStart.isPending}
          isLogoutPending={logoutSession.isPending}
          isUnlinkPending={unlinkAccount.isPending}
          onRefreshProfile={handleRunProfileRefresh}
          onReconnectGitHub={handleAccountRelink}
          onSignOut={handleSessionLogout}
          onDisconnectGitHub={handleUnlinkAccount}
          onDismissNotice={() => {
            setActionNotice("");
            setActionNoticeVariant("info");
          }}
        />
      </section>

      <section
        className="render-opt-section"
        id="settings-sync-activity-panel"
        data-scroll-target="true"
      >
        <SettingsSyncActivitySection
          runs={syncRuns}
          lastUpdatedAt={syncRunsQuery.data?.last_updated_at}
          lastAttemptedAt={syncRunsQuery.data?.last_attempted_at}
          lastSuccessfulAt={syncRunsQuery.data?.last_successful_at}
          isLoading={syncRunsQuery.isLoading}
          isRefreshing={syncRunsQuery.isFetching}
          isError={syncRunsQuery.isError}
          errorMessage={syncRunsError}
          onRefresh={() => {
            void syncRunsQuery.refetch();
          }}
        />
      </section>

      <section
        className="render-opt-section"
        id="settings-public-profile"
        data-scroll-target="true"
      >
        <SettingsPublicProfileCard
          privacy={currentSettings}
          isSaving={isSaving}
          disabled={isSaving}
          errorMessage={mutationError}
          onPrivacyChange={handlePrivacyToggle}
        />
      </section>

      <section
        className="render-opt-section"
        id="settings-display-preferences"
        data-scroll-target="true"
      >
        <SettingsDisplayPreferencesCard
          reducedGamification={currentSettings.reducedGamification}
          isSaving={isSaving}
          displayShortcutsEnabled={displayShortcutsEnabled}
          theme={theme}
          themeSource={themeSource}
          textScale={textScale}
          onReducedGamificationChange={(checked) => handlePrivacyToggle("reducedGamification", checked)}
          onDisplayShortcutsEnabledChange={setDisplayShortcutsEnabled}
          onThemeChange={setTheme}
          onClearThemePreference={clearThemePreference}
          onTextScaleChange={setTextScale}
        />
      </section>

      <section
        className="render-opt-section"
        id="settings-repositories"
        data-scroll-target="true"
      >
        <DeferUntilVisible fallback={<SettingsPanelPlaceholder label="Loading repository controls" />}>
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
        </DeferUntilVisible>
      </section>

      <section
        className="render-opt-section"
        id="settings-data-controls"
        data-scroll-target="true"
      >
        <SettingsDataControlsCard
          isActing={isActing}
          isExportPending={exportAccount.isPending}
          isDeletePending={deleteAccount.isPending}
          onExportAccountData={handleExportAccountData}
          onDeleteAccount={handleDeleteAccount}
        />
      </section>
    </div>
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

function SettingsPanelPlaceholder({ label }: { label: string }) {
  return (
    <PanelLoadingPlaceholder
      label={label}
      surface="plain"
      skeletons={[
        { className: "h-9 w-1/2" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
