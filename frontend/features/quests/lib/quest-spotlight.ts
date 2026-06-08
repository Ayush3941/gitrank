import { toRatioPercent } from "@/lib/formatters";
import type { Quest } from "@/types/gitrank";

export function selectQuestSpotlight(source: Quest[]): Quest | null {
  if (!source.length) {
    return null;
  }
  const ranked = [...source].sort((left, right) => {
    const leftRank = questStatusRank(left.status);
    const rightRank = questStatusRank(right.status);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftProgress = questProgressPercent(left);
    const rightProgress = questProgressPercent(right);
    if (leftProgress !== rightProgress) {
      return rightProgress - leftProgress;
    }
    if (left.rewardXp !== right.rewardXp) {
      return right.rewardXp - left.rewardXp;
    }
    return left.title.localeCompare(right.title);
  });
  return ranked[0] ?? null;
}

export function questProgressPercent(quest: Quest): number {
  const goal = quest.goal > 0 ? quest.goal : 1;
  return toRatioPercent(quest.progress / goal);
}

function questStatusRank(status: Quest["status"]): number {
  if (status === "Active") {
    return 0;
  }
  if (status === "Locked") {
    return 1;
  }
  return 2;
}
