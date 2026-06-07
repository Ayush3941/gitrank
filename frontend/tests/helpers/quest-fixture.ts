import type { Quest } from "@/types/gitrank";

export function buildQuest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: overrides.id ?? "quest-1",
    title: overrides.title ?? "Land reviewed work",
    description: overrides.description ?? "Complete one reviewed contribution.",
    status: overrides.status ?? "Active",
    cadence: overrides.cadence ?? "Weekly",
    rewardXp: overrides.rewardXp ?? 120,
    rewardBadgeId: overrides.rewardBadgeId,
    progress: overrides.progress ?? 0,
    goal: overrides.goal ?? 1,
    weakAreaTarget: overrides.weakAreaTarget ?? "Review",
    whyRecommended: overrides.whyRecommended ?? "Review evidence is currently thin.",
    evidenceSignals: overrides.evidenceSignals ?? ["review_depth=0"],
    linkedContributionIds: overrides.linkedContributionIds ?? [],
  };
}
