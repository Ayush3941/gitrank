export const leaderboardLanes = {
  Global: { id: "global", metric: "total_xp", label: "Total XP" },
  Backend: { id: "backend", metric: "skill_xp", label: "Backend XP" },
  Testing: { id: "testing", metric: "skill_xp", label: "Testing XP" },
  Documentation: { id: "documentation", metric: "skill_xp", label: "Documentation XP" },
  "Weekly XP": { id: "weekly", metric: "weekly_xp", label: "Weekly XP" },
  "Rising Contributors": { id: "rising", metric: "global_rank_movement", label: "Global places gained" },
} as const;

export type LeaderboardTab = keyof typeof leaderboardLanes;
