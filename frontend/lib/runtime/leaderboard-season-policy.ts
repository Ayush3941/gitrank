const DEFAULT_PROMOTION_RULE =
  "Top 25 move toward the next rank tier when the season locks.";
const DEFAULT_RESET_RULE =
  "Weekly XP resets after the window; total XP and score evidence are retained.";
const DEFAULT_PROMOTION_CUTOFF_RANK = 25;
const DEFAULT_SAFETY_CUTOFF_RANK = 75;

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  const integer = Math.trunc(value);
  if (integer <= 0) {
    return fallback;
  }
  return integer;
}

const promotionCutoffRank = parsePositiveInt(
  process.env.NEXT_PUBLIC_GITRANK_LEADERBOARD_PROMOTION_CUTOFF_RANK,
  DEFAULT_PROMOTION_CUTOFF_RANK,
);
const safetyCutoffRank = Math.max(
  promotionCutoffRank,
  parsePositiveInt(
    process.env.NEXT_PUBLIC_GITRANK_LEADERBOARD_SAFETY_CUTOFF_RANK,
    DEFAULT_SAFETY_CUTOFF_RANK,
  ),
);

export const leaderboardSeasonPolicy = {
  promotionRule:
    process.env.NEXT_PUBLIC_GITRANK_LEADERBOARD_PROMOTION_RULE ||
    DEFAULT_PROMOTION_RULE,
  resetRule:
    process.env.NEXT_PUBLIC_GITRANK_LEADERBOARD_RESET_RULE ||
    DEFAULT_RESET_RULE,
  promotionCutoffRank,
  safetyCutoffRank,
} as const;
