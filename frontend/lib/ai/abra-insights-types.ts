export type AbraContributionInput = {
  id: string;
  title: string;
  owner: string;
  repo: string;
  number: number;
  category: string;
  status: string;
  xpEarned: number;
  mergedAt: string;
  summary?: string;
  evidenceSignals: string[];
};

export type AbraBadgeInput = {
  id: string;
  name: string;
  rarity: string;
  unlocked: boolean;
  earnedAt?: string;
  description: string;
  unlockCondition: string;
  progress: number;
  evidencePrIds: string[];
};

export type AbraProfileInput = {
  username: string;
  displayName: string;
  currentTitle: string;
  rankTier: string;
  level: number;
  totalXp: number;
  mergedPrCount: number;
  strongestSignals: string[];
  repositoriesTouched: number;
  badgeCount: number;
  streakDays: number;
};

export type AbraInsightsRequest = {
  profile: AbraProfileInput;
  contributions: AbraContributionInput[];
  badges: AbraBadgeInput[];
};

export type ContributionNarrative = {
  what: string;
  why: string;
  signal: string;
  pitch: string;
};

export type BadgeStory = {
  story: string;
  trigger: string;
  nextFocus: string;
};

export type SkillInsight = {
  discipline: string;
  summary: string;
  evidence: string;
  confidence: "high" | "medium" | "emerging";
};

export type AbraInsightSource = "openai" | "gemini" | "deterministic";

export type AbraInsightsResponse = {
  generatedBy: AbraInsightSource;
  archetype: string;
  identitySummary: string;
  contributionNarratives: Record<string, ContributionNarrative>;
  badgeStories: Record<string, BadgeStory>;
  skillInsights: Record<string, SkillInsight>;
};
