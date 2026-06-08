"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  RevealPanel,
  RevealPanelSkeleton,
  RevealPanelUnavailable,
} from "@/features/onboarding/components/RevealPanel";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
} from "@/lib/ai/deterministic-identity-summary";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";

export function RevealPanelContainer() {
  const { data, isError, isLoading } = useMyProfile();
  const onboardingEventSentForUser = useRef<string>("");
  useAccountGamificationPreference(data);
  const streak = useMemo(
    () => summarizeContributionStreak(data?.user.contributions ?? []),
    [data?.user.contributions],
  );
  const abraPayload = useMemo(() => {
    return buildAbraInsightsRequest({
      user: data?.user,
      contributions: data?.user.contributions ?? [],
      badges: data?.user.badges ?? [],
      repositoriesTouched: data?.topRepositories.length ?? 0,
      streakDays: streak.currentStreakDays,
    });
  }, [data, streak.currentStreakDays]);
  const abraInsights = useAbraInsights(abraPayload);
  const fallbackArchetype = useMemo(
    () => (data ? deriveDeterministicArchetype(data.user.strongestSignals) : "Systems Builder"),
    [data],
  );
  const fallbackIdentitySummary = useMemo(() => {
    if (!data) {
      return undefined;
    }
    return buildDeterministicIdentitySummary({
      displayName: data.user.displayName,
      rankTier: data.user.level.rankTier,
      level: data.user.level.currentLevel,
      totalXp: data.user.level.currentXp,
      mergedPrCount: data.user.mergedPrCount,
      strongestSignals: data.user.strongestSignals,
      repositoriesTouched: data.topRepositories.length,
      streakDays: streak.currentStreakDays,
      isStale: data.isStale,
      trendWindowLabel: data.trendWindowLabel,
    });
  }, [data, streak.currentStreakDays]);

  useEffect(() => {
    if (isLoading || isError || !data) {
      return;
    }
    const username = data.user.username.trim().toLowerCase();
    if (!username || onboardingEventSentForUser.current === username) {
      return;
    }
    onboardingEventSentForUser.current = username;
    void emitAnalyticsEvent({
      eventName: "onboarding.completed",
      source: "frontend",
      target: "onboarding/reveal",
      status: "success",
    });
  }, [data, isError, isLoading]);

  if (isLoading) {
    return <RevealPanelSkeleton />;
  }

  if (isError || !data) {
    return <RevealPanelUnavailable />;
  }

  return (
    <RevealPanel
      user={data.user}
      archetype={abraInsights.data?.archetype ?? fallbackArchetype}
      identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
      aiMode={abraInsights.data?.generatedBy ?? "deterministic"}
    />
  );
}
