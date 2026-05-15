"use client";

import { useMemo } from "react";
import {
  RevealPanel,
  RevealPanelSkeleton,
  RevealPanelUnavailable,
} from "@/features/onboarding/components/RevealPanel";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useAccountGamificationPreference } from "@/hooks/use-gamification-preference";
import { useMyProfile } from "@/hooks/use-profile";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";

export function RevealPanelContainer() {
  const { data, isError, isLoading } = useMyProfile();
  useAccountGamificationPreference(data);
  const streak = useMemo(
    () => summarizeContributionStreak(data?.user.contributions ?? []),
    [data?.user.contributions],
  );
  const abraPayload = useMemo(() => {
    if (!data) {
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

  if (isLoading) {
    return <RevealPanelSkeleton />;
  }

  if (isError || !data) {
    return <RevealPanelUnavailable />;
  }

  return (
    <RevealPanel
      user={data.user}
      archetype={abraInsights.data?.archetype}
      identitySummary={abraInsights.data?.identitySummary}
      aiMode={abraInsights.data?.generatedBy}
    />
  );
}
