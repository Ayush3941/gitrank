"use client";

import { useMemo } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { PageHeader } from "@/components/shared/PageHeader";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { Button } from "@/components/ui/button";
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
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { SettingsAccountCard } from "@/features/settings/components/SettingsAccountCard";
import { SettingsDataControlsCard } from "@/features/settings/components/SettingsDataControlsCard";
import { SettingsDisplayPreferencesCard } from "@/features/settings/components/SettingsDisplayPreferencesCard";
import {
  SettingsPublicProfileCard,
  type SettingsPublicProfilePrivacyKey,
} from "@/features/settings/components/SettingsPublicProfileCard";
import { SettingsRepositoryVisibilitySection } from "@/features/settings/components/SettingsRepositoryVisibilitySection";
import { SettingsSyncActivitySection } from "@/features/settings/components/SettingsSyncActivitySection";
import { useSettingsAccountActions } from "@/features/settings/lib/use-settings-account-actions";

type BackedPrivacyKey = SettingsPublicProfilePrivacyKey | "reducedGamification";

const SETTINGS_SECTION_LINKS = [
  { id: "settings-account", label: "Account" },
  { id: "settings-sync-activity-panel", label: "Sync log" },
  { id: "settings-public-profile", label: "Privacy" },
  { id: "settings-display-preferences", label: "Display" },
  { id: "settings-repositories", label: "Repositories" },
  { id: "settings-data-controls", label: "Data" },
];

export function SettingsPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useMyProfile();
  const updatePrivacy = useUpdateProfilePrivacy();
  const updateRepositoryVisibility = useUpdateRepositoryVisibility();
  const syncRunsQuery = useSyncRuns(15);
  const { setReducedGamification } = useGamificationPreference();
  const { theme, themeSource, setTheme, clearThemePreference } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const { enabled: displayShortcutsEnabled, setEnabled: setDisplayShortcutsEnabled } =
    useDisplayShortcutsEnabled();
  useAccountGamificationPreference(data);
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
  const accountActions = useSettingsAccountActions({
    username: data?.user.username ?? "",
    appInstallationBlocked,
    isFetchingProfile: isFetching,
    refetchProfile: refetch,
    refetchSyncRuns: syncRunsQuery.refetch,
  });

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
  const isSaving = updatePrivacy.isPending || updateRepositoryVisibility.isPending;
  const isActing = accountActions.isActing;
  const pendingRepository = updateRepositoryVisibility.variables?.fullName ?? null;
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
          actionError={accountActions.actionError}
          actionNotice={accountActions.actionNotice}
          actionNoticeVariant={accountActions.actionNoticeVariant}
          isActing={isActing}
          isFetchingProfile={isFetching}
          isUserSyncPending={accountActions.isUserSyncPending}
          isRelinkPending={accountActions.isRelinkPending}
          isLogoutPending={accountActions.isLogoutPending}
          isUnlinkPending={accountActions.isUnlinkPending}
          onRefreshProfile={accountActions.refreshProfile}
          onReconnectGitHub={accountActions.reconnectGitHub}
          onSignOut={accountActions.signOut}
          onDisconnectGitHub={accountActions.disconnectGitHub}
          onDismissNotice={accountActions.clearActionNotice}
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
        <SettingsRepositoryVisibilitySection
          repositories={data.user.repositories}
          pendingRepository={pendingRepository}
          onRepositoryVisibilityChange={(repository, checked) => {
            updateRepositoryVisibility.mutate({
              fullName: repository.name,
              visibility: checked ? "Public" : "Hidden",
              reason: repository.reason,
            });
          }}
        />
      </section>

      <section
        className="render-opt-section"
        id="settings-data-controls"
        data-scroll-target="true"
      >
        <SettingsDataControlsCard
          isActing={isActing}
          isExportPending={accountActions.isExportPending}
          isDeletePending={accountActions.isDeletePending}
          onExportAccountData={accountActions.exportAccountData}
          onDeleteAccount={accountActions.deleteAccount}
        />
      </section>
    </div>
  );
}
