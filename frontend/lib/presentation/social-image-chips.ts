export type SocialImageChip = {
  id: string;
  label: string;
};

export type SocialImageChipGroup =
  | "homeOpenGraph"
  | "homeTwitter"
  | "profileOpenGraph"
  | "profileTwitter"
  | "prOpenGraph"
  | "prTwitter";

export const SOCIAL_IMAGE_CHIP_GROUPS = {
  homeOpenGraph: [
    { id: "pr-impact", label: "PR Impact" },
    { id: "xp-levels", label: "XP + Levels" },
    { id: "badges-quests", label: "Badges + Quests" },
    { id: "public-profile", label: "Public Profile" },
  ],
  homeTwitter: [
    { id: "sync-github", label: "Sync GitHub" },
    { id: "analyze-prs", label: "Analyze PRs" },
    { id: "earn-xp", label: "Earn XP" },
    { id: "climb-leaderboard", label: "Climb Leaderboard" },
  ],
  profileOpenGraph: [
    { id: "pr-impact", label: "PR Impact" },
    { id: "xp-movement", label: "XP Movement" },
    { id: "badge-story", label: "Badge Story" },
    { id: "rank-progression", label: "Rank Progression" },
  ],
  profileTwitter: [
    { id: "contributions", label: "Contributions" },
    { id: "badges", label: "Badges" },
    { id: "quests", label: "Quests" },
    { id: "leaderboard", label: "Leaderboard" },
  ],
  prOpenGraph: [
    { id: "difficulty", label: "Difficulty" },
    { id: "impact", label: "Impact" },
    { id: "review-depth", label: "Review Depth" },
    { id: "xp-drivers", label: "XP Drivers" },
  ],
  prTwitter: [
    { id: "score-matrix", label: "Score Matrix" },
    { id: "evidence-signals", label: "Evidence Signals" },
    { id: "xp-breakdown", label: "XP Breakdown" },
    { id: "recommendations", label: "Recommendations" },
  ],
} satisfies Record<SocialImageChipGroup, readonly SocialImageChip[]>;

