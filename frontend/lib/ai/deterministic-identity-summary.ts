export function shouldRequestAbraInsights({
  showAiSummaries,
  mergedPrCount,
  contributionCount,
}: {
  showAiSummaries: boolean;
  mergedPrCount: number;
  contributionCount: number;
}) {
  return showAiSummaries && mergedPrCount > 0 && contributionCount > 0;
}

export function deriveDeterministicArchetype(strongestSignals: string[]): string {
  const topSignal = strongestSignals[0]?.toLowerCase() ?? "";
  if (topSignal.includes("security")) {
    return "Guardian Engineer";
  }
  if (topSignal.includes("performance")) {
    return "Performance Strategist";
  }
  if (topSignal.includes("architecture")) {
    return "Systems Architect";
  }
  if (topSignal.includes("infrastructure") || topSignal.includes("devops")) {
    return "Infrastructure Operator";
  }
  if (topSignal.includes("testing") || topSignal.includes("review")) {
    return "Quality Champion";
  }
  if (topSignal.includes("documentation")) {
    return "Knowledge Builder";
  }
  return "Systems Builder";
}

export function buildDeterministicIdentitySummary({
  displayName,
  rankTier,
  level,
  totalXp,
  mergedPrCount,
  strongestSignals,
  repositoriesTouched,
  streakDays,
  isStale,
  trendWindowLabel,
}: {
  displayName: string;
  rankTier: string;
  level: number;
  totalXp: number;
  mergedPrCount: number;
  strongestSignals: string[];
  repositoriesTouched: number;
  streakDays: number;
  isStale: boolean;
  trendWindowLabel: string;
}) {
  const signalSummary =
    strongestSignals.length > 0
      ? strongestSignals.slice(0, 2).join(" and ")
      : "early contribution patterns";
  const staleNote = isStale
    ? " This snapshot is currently marked stale and will sharpen after refresh."
    : "";
  if (mergedPrCount <= 0) {
    return `${displayName} is currently ${rankTier} (Level ${level}) with ${totalXp.toLocaleString("en-US")} total XP and no merged PR evidence in the active ${trendWindowLabel} window yet. Connect fresh merged work to unlock stronger skill confidence, badge momentum, and clearer archetype movement.${staleNote}`;
  }
  return `${displayName} is currently ${rankTier} (Level ${level}) with ${totalXp.toLocaleString("en-US")} total XP from ${mergedPrCount} merged PRs across ${repositoriesTouched} repositories. Recent strength signals are concentrated around ${signalSummary}, with a current streak of ${streakDays} day${streakDays === 1 ? "" : "s"} in the ${trendWindowLabel} window.${staleNote}`;
}
