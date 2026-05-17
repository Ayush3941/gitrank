import type { LeaderboardTab } from "@/lib/api/leaderboard-api";

const LANE_TO_TAB: Record<string, LeaderboardTab> = {
  global: "Global",
  backend: "Backend",
  testing: "Testing",
  documentation: "Documentation",
  "weekly-xp": "Weekly XP",
  "rising-contributors": "Rising Contributors",
};

const TAB_TO_LANE: Record<LeaderboardTab, string> = {
  Global: "global",
  Backend: "backend",
  Testing: "testing",
  Documentation: "documentation",
  "Weekly XP": "weekly-xp",
  "Rising Contributors": "rising-contributors",
};

export function tabToLaneParam(tab: LeaderboardTab): string {
  return TAB_TO_LANE[tab];
}

export function laneParamToTab(value: string | null): LeaderboardTab | null {
  if (!value) {
    return null;
  }
  return LANE_TO_TAB[value.toLowerCase()] ?? null;
}
