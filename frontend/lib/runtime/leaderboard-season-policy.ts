const DEFAULT_PROMOTION_RULE =
  "Top 25 move toward the next rank tier when the season locks.";
const DEFAULT_RESET_RULE =
  "Weekly XP resets after the window; total XP and score evidence are retained.";

export const leaderboardSeasonPolicy = {
  promotionRule:
    process.env.NEXT_PUBLIC_GITRANK_LEADERBOARD_PROMOTION_RULE ||
    DEFAULT_PROMOTION_RULE,
  resetRule:
    process.env.NEXT_PUBLIC_GITRANK_LEADERBOARD_RESET_RULE ||
    DEFAULT_RESET_RULE,
} as const;
