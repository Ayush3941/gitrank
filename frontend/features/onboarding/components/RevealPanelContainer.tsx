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
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
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
    if (!data) {
      return null;
    }
    if (
      !shouldRequestAbraInsights({
        showAiSummaries: data.user.privacy.showAiSummaries !== false,
        mergedPrCount: data.user.mergedPrCount,
        contributionCount: data.user.contributions.length,
      })
    ) {
      return null;
    }
    return {
      profile: {
        username: data.user.username,
        displayName: data.user.displayName,
        currentTitle: data.user.title,
        rankTier: data.user.level.rankTier,
        level: data.user.level.currentLevel,
        totalXp: data.user.level.currentXp,
        mergedPrCount: data.user.mergedPrCount,
        strongestSignals: data.user.strongestSignals,
        repositoriesTouched: data.topRepositories.length,
        badgeCount: data.user.badges.filter((badge) => badge.unlocked).length,
        streakDays: streak.currentStreakDays,
      },
      contributions: data.user.contributions.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.title,
        owner: row.owner,
        repo: row.repo,
        number: row.number,
        category: row.category,
        status: row.status,
        xpEarned: row.xpEarned,
        mergedAt: row.mergedAt,
        summary: row.aiSummary,
        evidenceSignals: row.evidenceSignals,
      })),
      badges: data.user.badges.slice(0, 8).map((badge) => ({
        id: badge.id,
        name: badge.name,
        rarity: badge.rarity,
        unlocked: badge.unlocked,
        earnedAt: badge.earnedAt,
        description: badge.description,
        unlockCondition: badge.unlockCondition,
        progress: badge.progress ?? (badge.unlocked ? 100 : 0),
        evidencePrIds: badge.evidencePrIds,
      })),
    };
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
