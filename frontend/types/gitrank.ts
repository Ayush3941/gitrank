export type RankTier =
  | "Bronze I"
  | "Silver II"
  | "Gold III"
  | "Platinum I"
  | "Diamond";

export type PRCategory =
  | "Documentation"
  | "Testing"
  | "Bug Fix"
  | "Backend"
  | "Infrastructure"
  | "Security"
  | "Performance"
  | "Architecture"
  | "Review";

export type BadgeRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Mythic";

export type QuestStatus = "Locked" | "Active" | "Completed";

export type SyncState =
  | "never_synced"
  | "syncing"
  | "partially_synced"
  | "synced"
  | "stale"
  | "failed"
  | "rate_limited";

export type ContributionStatus = "merged" | "open" | "closed";

export type SkillCategory =
  | "Documentation"
  | "Testing"
  | "Backend"
  | "Frontend"
  | "DevOps"
  | "Security"
  | "Performance"
  | "Architecture"
  | "Review";

export type PreviewMode = "default" | "loading" | "error" | "empty" | "stale";
export type BadgeIcon =
  | "bolt"
  | "book"
  | "calendar"
  | "crown"
  | "flask"
  | "lock"
  | "messages"
  | "scroll"
  | "server"
  | "shield"
  | "wrench";

export interface GitRankLevel {
  currentLevel: number;
  title: string;
  currentXp: number;
  nextLevelXp: number;
  rankTier: RankTier;
}

export interface LeaderboardSeason {
  id: string;
  name: string;
  windowLabel: string;
  startsAt: string;
  endsAt: string;
  status: "Active" | "Locked" | "Preview";
  scoringVersion: string;
  promotionRule: string;
  resetRule: string;
  explanation: string;
}

export interface RankProgress {
  season: LeaderboardSeason;
  currentTier: RankTier;
  nextTier?: RankTier;
  seasonXp: number;
  xpToNextTier: number;
  promotionCutoffRank: number;
  safetyCutoffRank: number;
  evidenceSignals: string[];
}

export interface SkillNode {
  category: SkillCategory;
  score: number;
  delta: number;
  note: string;
  evidenceSource?: "deterministic" | "ai_assisted" | "mixed" | "unknown";
  confidence?: number;
  evidenceState?: "fresh" | "stale" | "partial";
}

export interface ScoreBreakdown {
  label: string;
  deltaXp: number;
  type: "gain" | "penalty";
  reason: string;
}

export interface ScoreComponent {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  source: string;
  reason: string;
}

export interface PRBadgeUnlock {
  key: string;
  name: string;
  description?: string;
  awardedAt: string;
  rule?: string;
  ruleVersion?: string;
  evidenceSignals: string[];
  evidencePrIds: string[];
}

export interface Contribution {
  id: string;
  scoreEventId?: string;
  scoreVersion?: string;
  formulaVersion?: string;
  pullRequestId?: string;
  analysisId?: string;
  evidenceState?: "complete" | "partial";
  evidenceMissing?: string[];
  owner: string;
  repo: string;
  number: number;
  title: string;
  status: ContributionStatus;
  category: PRCategory;
  difficultyScore: number;
  impactScore: number;
  reviewDepthScore: number;
  testSignalScore: number;
  repoWeight: number;
  antiSpamMultiplier: number;
  xpEarned: number;
  additions: number;
  deletions: number;
  changedFilesCount: number;
  mergedAt: string;
  maintainerReviewed: boolean;
  linkedIssue: boolean;
  ciPassed: boolean;
  aiSummary: string;
  evidenceSignals: string[];
}

export interface PullRequestAnalysis {
  contribution: Contribution;
  baseValue: number;
  mergedBonus: number;
  reviewBonus: number;
  testBonus: number;
  repoBonus: number;
  aiConfidence: number;
  penalties: ScoreBreakdown[];
  scoreComponents: ScoreComponent[];
  badgeUnlocks: PRBadgeUnlock[];
  suggestedQuestId: string;
  suggestedQuest?: PRSuggestedQuest;
  evidenceState: PREvidenceState;
}

export interface PREvidenceState {
  status:
    | "complete"
    | "incomplete"
    | "stale"
    | "deterministic_only"
    | "ai_fallback"
    | "rate_limited";
  reasons: string[];
  missingEvidence: string[];
  analysisSource?: string;
  analysisConfidence?: number;
  deterministicOnly: boolean;
  aiFallback: boolean;
  rateLimited: boolean;
  stale: boolean;
}

export interface PRSuggestedQuest {
  id: string;
  title: string;
  description: string;
  status: string;
  weakAreaTarget?: SkillCategory;
  whyRecommended: string;
  evidenceSignals: string[];
}

export interface Badge {
  id: string;
  name: string;
  rarity: BadgeRarity;
  description: string;
  unlockCondition: string;
  icon: BadgeIcon;
  unlocked: boolean;
  earnedAt?: string;
  progress?: number;
  evidencePrIds: string[];
  rarityScore?: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  status: QuestStatus;
  cadence: "Daily" | "Weekly" | "Long-term" | "Skill-based";
  rewardXp: number;
  rewardBadgeId?: string;
  progress: number;
  goal: number;
  weakAreaTarget?: SkillCategory;
  whyRecommended: string;
  evidenceSignals: string[];
  linkedContributionIds: string[];
}

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt?: string;
  currentStep?: string;
  progress: number;
  partialProfileAvailable: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  title: string;
  rankTier: RankTier;
  weeklyXp: number;
  totalXp: number;
  movement: number;
  focus: SkillCategory;
  isCurrentUser?: boolean;
  division: string;
  seasonXp: number;
  xpToNextRank: number;
  promotionZone: boolean;
  demotionRisk: boolean;
  evidenceSummary: string;
  scoreFormulaVersion: string;
}

export interface LeaderboardSnapshot {
  season: LeaderboardSeason;
  rows: LeaderboardEntry[];
  currentUser?: LeaderboardEntry;
}

export interface PrivacySettings {
  publicProfileEnabled: boolean;
  showExactPRs: boolean;
  showAiSummaries: boolean;
  showLeaderboardParticipation: boolean;
  badgeUnlockedNotifications: boolean;
  levelUpNotifications: boolean;
  weeklyReportNotifications: boolean;
  reducedGamification: boolean;
}

export interface RepositoryVisibility {
  name: string;
  tracked: boolean;
  visibility: "Public" | "Hidden";
  reason: string;
}

export interface FeaturedContribution {
  id: string;
  scoreEventId?: string;
  scoreVersion?: string;
  formulaVersion?: string;
  pullRequestId?: string;
  analysisId?: string;
  evidenceState?: "complete" | "partial";
  evidenceMissing?: string[];
  owner: string;
  repo: string;
  number: number;
  title: string;
  summary: string;
  xpEarned: number;
  happenedAt: string;
}

export interface ProfileRepositorySummary {
  name: string;
  owner: string;
  repo: string;
  totalXp: number;
  contributionCount: number;
  visibility: "Public" | "Hidden";
  primarySkill?: SkillCategory;
}

export interface UserProfile {
  username: string;
  displayName: string;
  title: string;
  avatarUrl: string;
  bio: string;
  gitRankScore: number;
  mergedPrCount: number;
  reviewedPrCount: number;
  bestCategory: SkillCategory;
  consistencyScore: number;
  strongestSignals: SkillCategory[];
  topSkills: SkillCategory[];
  level: GitRankLevel;
  rankProgress: RankProgress;
  skillTree: SkillNode[];
  contributions: Contribution[];
  badges: Badge[];
  quests: Quest[];
  scoreChanges: ScoreBreakdown[];
  xpTimeline: Array<{ label: string; xp: number }>;
  syncStatus: SyncStatus;
  weeklyXp: number;
  leaguePosition: number;
  movement: number;
  repositories: RepositoryVisibility[];
  privacy: PrivacySettings;
}

export interface ProfileViewData {
  user: UserProfile;
  featuredContributions: FeaturedContribution[];
  topRepositories: ProfileRepositorySummary[];
  recentReports: PullRequestAnalysis[];
  shareHeadline: string;
  trendWindowLabel: string;
  refreshedAt: string;
  isStale: boolean;
  partialProfileAvailable: boolean;
}

export interface DashboardData {
  user: UserProfile;
  recentReports: PullRequestAnalysis[];
}
