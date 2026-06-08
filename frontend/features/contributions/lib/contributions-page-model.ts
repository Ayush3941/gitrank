import type { ContributionShelfModel } from "@/features/contributions/lib/contribution-shelf-model";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import type { AbraInsightsRequest } from "@/lib/ai/abra-insights-types";
import {
  summarizeContributionStreak,
  summarizeRepositories,
} from "@/lib/metrics/contribution-metrics";
import { buildStaleSyncNotice, type StaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";
import type { SyncState, ProfileViewData } from "@/types/gitrank";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

export type ContributionsPageModelInput = {
  profile?: ProfileViewData;
  contributionShelf: ContributionShelfModel;
  displaySyncState: SyncState;
  latestSyncOutcome: SyncRunDiagnostic | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
};

export type ContributionsPageModel = {
  repositories: ReturnType<typeof summarizeRepositories>;
  streak: ReturnType<typeof summarizeContributionStreak>;
  staleNotice: StaleSyncNotice;
  abraPayload: AbraInsightsRequest | null;
  hasCachedProfile: boolean;
  shouldBlockOnLoading: boolean;
  shouldBlockOnError: boolean;
  shouldShowStaleState: boolean;
  backgroundRefreshError: string;
};

export function buildContributionsPageModel({
  profile,
  contributionShelf,
  displaySyncState,
  latestSyncOutcome,
  isLoading,
  isError,
  errorMessage = "",
}: ContributionsPageModelInput): ContributionsPageModel {
  const contributions = profile?.user.contributions ?? [];
  const repositories = summarizeRepositories(contributions);
  const streak = summarizeContributionStreak(contributions);
  const staleNotice = buildStaleSyncNotice({
    syncState: displaySyncState === "partially_synced" ? "partially_synced" : "stale",
    refreshedAt: profile?.refreshedAt,
    latestSyncOutcome,
    snapshotLabel: "Contribution evidence",
    partialFallback:
      "Profile exists, but scored PR evidence is still empty. Keep auto-sync on and retry.",
    staleFallback:
      "New PR rows appear after sync completes.",
  });
  const abraPayload = buildAbraInsightsRequest({
    user: profile?.user,
    contributions: contributionShelf.abraContributionSample,
    badges: profile?.user.badges ?? [],
    repositoriesTouched: repositories.length,
    streakDays: streak.currentStreakDays,
    enabled: contributionShelf.effectiveShowCardDetails,
  });
  const hasCachedProfile = Boolean(profile);
  const shouldBlockOnLoading = isLoading && !hasCachedProfile;
  const shouldBlockOnError = isError && !hasCachedProfile;
  const shouldShowStaleState =
    Boolean(profile) && (displaySyncState === "stale" || displaySyncState === "partially_synced");
  const backgroundRefreshError =
    isError && hasCachedProfile
      ? `${sanitizeUserFacingError(errorMessage, "stale-refresh")} Showing latest verified contribution data.`
      : "";

  return {
    repositories,
    streak,
    staleNotice,
    abraPayload,
    hasCachedProfile,
    shouldBlockOnLoading,
    shouldBlockOnError,
    shouldShowStaleState,
    backgroundRefreshError,
  };
}
