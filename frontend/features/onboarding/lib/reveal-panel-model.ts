import type { AbraInsightSource } from "@/lib/ai/abra-insights-types";
import { uniqueDisplayValues } from "@/lib/display-values";
import {
  formatNumber,
  formatPluralCount,
  formatXpProgressLabel,
} from "@/lib/formatters";
import { formatAIInsightSourceLabel } from "@/lib/presentation/ai-insight-source";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { deriveEffectiveSyncState } from "@/lib/presentation/sync-evidence";
import type { Badge, UserProfile } from "@/types/gitrank";

type RevealMetricModel = {
  id: string;
  label: string;
  value: string;
};

type RevealNextActionModel = {
  id: string;
  text: string;
};

export type RevealPanelModel = {
  aiSourceLabel: string;
  strongestSignalSummary: string;
  unlockedBadges: Badge[];
  evidenceRows: number;
  evidenceRowsLabel: string;
  effectiveSyncState: ReturnType<typeof deriveEffectiveSyncState>;
  needsSyncRecovery: boolean;
  recoveryActionLabel: string;
  nextActions: readonly RevealNextActionModel[];
  nextActionsLabel: string;
  metrics: RevealMetricModel[];
  unlockPreviewLabel: string;
  xpProgressLabel: string;
  shareHeadline: string;
};

const FIRST_EVIDENCE_ACTIONS: readonly RevealNextActionModel[] = [
  {
    id: "merge-first-pr",
    text: "Merge your first meaningful PR so score movement can activate.",
  },
  {
    id: "refresh-evidence",
    text: "Open sync settings to refresh and attach fresh GitHub evidence to this profile.",
  },
  {
    id: "open-quests",
    text: "Open quests to target your first high-signal contribution type.",
  },
];

const ACTIVE_PROFILE_ACTIONS: readonly RevealNextActionModel[] = [
  {
    id: "open-dashboard",
    text: "Open dashboard to inspect score movement and weekly XP.",
  },
  {
    id: "review-contributions",
    text: "Review contribution drill-down for high-impact PR evidence cards.",
  },
  {
    id: "share-public-profile",
    text: "Share your public profile once privacy toggles are set.",
  },
];

export function buildRevealPanelModel({
  user,
  aiMode,
}: {
  user: UserProfile;
  aiMode?: AbraInsightSource;
}): RevealPanelModel {
  const aiSourceLabel = formatAIInsightSourceLabel(aiMode);
  const strongestSignals = uniqueDisplayValues(user.strongestSignals, 4);
  const strongestSignalSummary =
    strongestSignals.length > 0 ? strongestSignals.join(", ") : "recent contribution";
  const unlockedBadges = deduplicateBadgesByName(user.badges)
    .filter((badge) => badge.unlocked)
    .slice(0, 3);
  const evidenceRows = user.contributions.length;
  const effectiveSyncState = deriveEffectiveSyncState(user);
  const needsSyncRecovery =
    evidenceRows === 0 ||
    effectiveSyncState === "never_synced" ||
    effectiveSyncState === "partially_synced" ||
    effectiveSyncState === "failed" ||
    effectiveSyncState === "rate_limited";
  const recoveryActionLabel =
    effectiveSyncState === "failed" || effectiveSyncState === "rate_limited"
      ? "Retry sync analysis"
      : "Continue sync analysis";
  const nextActions =
    user.mergedPrCount === 0 ? FIRST_EVIDENCE_ACTIONS : ACTIVE_PROFILE_ACTIONS;
  const metrics = [
    { id: "merged-prs", label: "Merged PRs", value: formatNumber(user.mergedPrCount) },
    { id: "reviewed-prs", label: "Reviewed PRs", value: formatNumber(user.reviewedPrCount) },
    { id: "unlocked-badges", label: "Unlocked badges", value: formatNumber(unlockedBadges.length) },
    { id: "evidence-rows", label: "Evidence rows", value: formatNumber(evidenceRows) },
  ];
  const evidenceRowsLabel =
    evidenceRows > 0
      ? ` This reveal includes ${formatPluralCount(evidenceRows, "persisted contribution evidence row")}.`
      : " No scored contribution evidence is attached yet; merge one PR and re-sync to unlock deeper profile interpretation.";

  return {
    aiSourceLabel,
    strongestSignalSummary,
    unlockedBadges,
    evidenceRows,
    evidenceRowsLabel,
    effectiveSyncState,
    needsSyncRecovery,
    recoveryActionLabel,
    nextActions,
    nextActionsLabel: formatPluralCount(nextActions.length, "step"),
    metrics,
    unlockPreviewLabel:
      unlockedBadges.length > 0 ? `${unlockedBadges.length} earned` : "next badge targets",
    xpProgressLabel: formatXpProgressLabel(user.level.currentXp, user.level.nextLevelXp),
    shareHeadline: `${user.displayName} is ${user.title} on GitRank.`,
  };
}
