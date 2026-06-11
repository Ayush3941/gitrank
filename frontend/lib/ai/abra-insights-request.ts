import type {
  AbraBadgeInput,
  AbraContributionInput,
  AbraInsightsRequest,
} from "@/lib/ai/abra-insights-types";
import { shouldRequestAbraInsights } from "@/lib/ai/deterministic-identity-summary";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import type { Badge, Contribution, UserProfile } from "@/types/gitrank";

const DEFAULT_ABRA_CONTRIBUTION_LIMIT = 8;
const DEFAULT_ABRA_BADGE_LIMIT = 8;

export function buildAbraInsightsRequest({
  user,
  contributions,
  badges,
  repositoriesTouched,
  streakDays,
  enabled = true,
  contributionLimit = DEFAULT_ABRA_CONTRIBUTION_LIMIT,
  badgeLimit = DEFAULT_ABRA_BADGE_LIMIT,
  badgeCount,
  contributionCountForGate,
}: {
  user: UserProfile | null | undefined;
  contributions: Contribution[];
  badges: Badge[];
  repositoriesTouched: number;
  streakDays: number;
  enabled?: boolean;
  contributionLimit?: number;
  badgeLimit?: number;
  badgeCount?: number;
  contributionCountForGate?: number;
}): AbraInsightsRequest | null {
  if (!user || !enabled) {
    return null;
  }
  const visibleBadges = deduplicateBadgesByName(badges);
  if (
    !shouldRequestAbraInsights({
      showAiSummaries: user.privacy.showAiSummaries !== false,
      mergedPrCount: user.mergedPrCount,
      contributionCount: contributionCountForGate ?? contributions.length,
    })
  ) {
    return null;
  }
  return {
    profile: {
      username: user.username,
      displayName: user.displayName,
      currentTitle: user.title,
      rankTier: user.level.rankTier,
      level: user.level.currentLevel,
      totalXp: user.level.currentXp,
      mergedPrCount: user.mergedPrCount,
      strongestSignals: user.strongestSignals,
      repositoriesTouched,
      badgeCount: badgeCount ?? visibleBadges.filter((badge) => badge.unlocked).length,
      streakDays,
    },
    contributions: contributions.slice(0, contributionLimit).map(toAbraContributionInput),
    badges: visibleBadges.slice(0, badgeLimit).map(toAbraBadgeInput),
  };
}

function toAbraContributionInput(row: Contribution): AbraContributionInput {
  return {
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
  };
}

function toAbraBadgeInput(badge: Badge): AbraBadgeInput {
  return {
    id: badge.id,
    name: badge.name,
    rarity: badge.rarity,
    unlocked: badge.unlocked,
    earnedAt: badge.earnedAt,
    description: badge.description,
    unlockCondition: badge.unlockCondition,
    progress: badge.progress ?? (badge.unlocked ? 100 : 0),
    evidencePrIds: badge.evidencePrIds,
  };
}
