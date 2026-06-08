export type OnboardingCopyLine = {
  id: string;
  text: string;
};

export type OnboardingStepCopy = OnboardingCopyLine & {
  step: string;
  title?: string;
};

export const LOGIN_PANEL_STEPS: readonly OnboardingStepCopy[] = [
  { id: "github-oauth", step: "Step 1", text: "Sign in with GitHub OAuth." },
  { id: "sync-evidence", step: "Step 2", text: "GitRank syncs contribution evidence." },
  { id: "open-dashboard", step: "Step 3", text: "Open your dashboard and quests." },
];

export const LOGIN_SCORE_RULES: readonly OnboardingCopyLine[] = [
  { id: "merged-work", text: "Merged work outranks streak volume." },
  { id: "review-depth", text: "Review depth matters." },
  { id: "tests-repo-context", text: "Tests and repo context affect XP." },
  { id: "anti-spam", text: "Spam-like PR floods get reduced multipliers." },
];

export const CONNECT_GITHUB_STEPS: readonly OnboardingStepCopy[] = [
  {
    id: "authorize-github",
    step: "Step 1",
    title: "Authorize GitHub",
    text: "Sign in and approve read-only contribution metadata access.",
  },
  {
    id: "sync-evidence",
    step: "Step 2",
    title: "Sync evidence",
    text: "GitRank pulls recent merged PR, review, and repo context data.",
  },
  {
    id: "reveal-profile",
    step: "Step 3",
    title: "Reveal profile",
    text: "You enter analyzing and unlock your first score snapshot.",
  },
];

export const CONNECT_DATA_READ_ROWS: readonly OnboardingCopyLine[] = [
  { id: "profile-basics", text: "Public profile basics and contribution activity." },
  { id: "pr-context", text: "Merged PR metadata, reviews, and changed-file context." },
  { id: "repo-context", text: "Repository visibility and recency scoring context." },
];

export const CONNECT_DATA_NOT_READ_ROWS: readonly OnboardingCopyLine[] = [
  { id: "private-code", text: "Private repository code content in v1." },
  { id: "local-secrets", text: "Hidden local environment secrets." },
  { id: "manual-overrides", text: "Manual score overrides or admin edits." },
];

export const CONNECT_PRIVACY_CONTROLS: readonly OnboardingCopyLine[] = [
  { id: "public-profile-toggle", text: "Public profile can be disabled at any time." },
  {
    id: "privacy-toggles",
    text: "Exact PRs, AI summaries, and leaderboard participation are individually controlled.",
  },
  {
    id: "repository-visibility",
    text: "Repository visibility can be hidden without deleting the account.",
  },
];

