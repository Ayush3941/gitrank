import {
  buildDashboardStaleNotice,
  type DashboardStaleNotice,
} from "@/features/dashboard/lib/stale-notice";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
} from "@/lib/ai/deterministic-identity-summary";
import type { AbraInsightsRequest } from "@/lib/ai/abra-insights-types";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";
import type { SyncState, UserProfile } from "@/types/gitrank";

export type DashboardPageModelInput = {
  user?: UserProfile | null;
  isStale?: boolean;
  trendWindowLabel?: string;
  refreshedAt?: string;
  displaySyncState: SyncState;
  latestSyncOutcome: SyncRunDiagnostic | null;
  constrainedNetwork: boolean;
};

export type DashboardPageModel = {
  streak: ReturnType<typeof summarizeContributionStreak>;
  abraPayload: AbraInsightsRequest | null;
  fallbackArchetype: string;
  fallbackIdentitySummary?: string;
  staleNotice: DashboardStaleNotice | null;
};

export function buildDashboardPageModel({
  user,
  isStale = false,
  trendWindowLabel = "current window",
  refreshedAt,
  displaySyncState,
  latestSyncOutcome,
  constrainedNetwork,
}: DashboardPageModelInput): DashboardPageModel {
  const streak = summarizeContributionStreak(user?.contributions ?? []);
  const abraPayload = buildAbraInsightsRequest({
    user,
    contributions: user?.contributions ?? [],
    badges: user?.badges ?? [],
    repositoriesTouched: user?.repositories.length ?? 0,
    streakDays: streak.currentStreakDays,
    enabled: !constrainedNetwork,
  });
  const fallbackArchetype = user
    ? deriveDeterministicArchetype(user.strongestSignals)
    : "Systems Builder";
  const fallbackIdentitySummary = user
    ? buildDeterministicIdentitySummary({
        displayName: user.displayName,
        rankTier: user.level.rankTier,
        level: user.level.currentLevel,
        totalXp: user.level.currentXp,
        mergedPrCount: user.mergedPrCount,
        strongestSignals: user.strongestSignals,
        repositoriesTouched: user.repositories.length,
        streakDays: streak.currentStreakDays,
        isStale,
        trendWindowLabel,
      })
    : undefined;
  const shouldBuildStaleNotice =
    Boolean(refreshedAt) &&
    (displaySyncState === "stale" || displaySyncState === "partially_synced");
  const staleNotice =
    shouldBuildStaleNotice && refreshedAt
      ? buildDashboardStaleNotice(displaySyncState, refreshedAt, latestSyncOutcome)
      : null;

  return {
    streak,
    abraPayload,
    fallbackArchetype,
    fallbackIdentitySummary,
    staleNotice,
  };
}
