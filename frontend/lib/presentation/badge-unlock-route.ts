const QUEST_RECOVERY_TERMS = ["streak", "weekly", "daily", "quest"];

export function badgeUnlockRecoveryHref(condition: string): string {
  return targetsQuestRecovery(condition) ? "/dashboard/quests" : "/dashboard/contributions";
}

export function badgeUnlockRecoveryLabel(condition: string): string {
  return targetsQuestRecovery(condition) ? "Open quests" : "Open contributions";
}

function targetsQuestRecovery(condition: string): boolean {
  const text = condition.toLowerCase();
  return QUEST_RECOVERY_TERMS.some((term) => text.includes(term));
}
