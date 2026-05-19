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
  return `${displayName} is currently ${rankTier} (Level ${level}) with ${totalXp.toLocaleString("en-US")} total XP from ${mergedPrCount} merged PRs across ${repositoriesTouched} repositories. Recent strength signals are concentrated around ${signalSummary}, with a current streak of ${streakDays} day${streakDays === 1 ? "" : "s"} in the ${trendWindowLabel} window.${staleNote}`;
}
