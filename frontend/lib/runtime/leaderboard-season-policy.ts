export const leaderboardSeasonPolicy = {
  promotionRule: "Top 25 move toward the next rank tier when the season locks.",
  resetRule: "Weekly XP resets after the window; total XP and score evidence are retained.",
  promotionCutoffRank: 25,
  safetyCutoffRank: 75,
} as const;
