import { getUserProfile as getMockUserProfile } from "@/lib/api/mock-api";
import { prAnalyses } from "@/lib/mock-data/gitrank";
import type {
  Badge,
  BadgeIcon,
  BadgeRarity,
  FeaturedContribution,
  PreviewMode,
  PrivacySettings,
  ProfileRepositorySummary,
  ProfileViewData,
  RepositoryVisibility,
  SkillCategory,
  SkillNode,
  UserProfile,
} from "@/types/gitrank";

const DEFAULT_CSRF_COOKIE_NAME =
  process.env.NEXT_PUBLIC_GITRANK_CSRF_COOKIE_NAME ?? "gitrank_csrf";

type ApiProfileSummary = {
  handle: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  total_xp: number;
  strength_summary: string;
  top_skills?: string[];
  badges_earned: number;
  merged_pull_requests: number;
  updated_at: string;
};

type ApiSkillArea = {
  key: string;
  total_xp: number;
  percentage: number;
  summary?: string;
};

type ApiRepository = {
  full_name: string;
  owner: string;
  name: string;
  total_xp: number;
  contribution_count: number;
  merged_pull_requests: number;
  primary_skill?: string;
  last_contribution_at: string;
  visibility: string;
};

type ApiLevel = {
  label: string;
  current_level: number;
  current_xp: number;
  next_level_xp: number;
  rank_tier: string;
};

type ApiBadge = {
  key: string;
  name: string;
  description?: string;
  awarded_at: string;
  evidence?: Record<string, unknown>;
};

type ApiPullRequestReference = {
  repository: string;
  number: number;
  title?: string;
};

type ApiScoreHistoryEntry = {
  event_id: string;
  event_type: string;
  delta_xp: number;
  created_at: string;
  pull_request?: ApiPullRequestReference;
  explanation?: string[];
};

type ApiTimelinePoint = {
  bucket_start: string;
  bucket_end: string;
  delta_xp: number;
  total_xp: number;
};

type ApiTimeline = {
  window: {
    label: string;
    bucket: string;
    start_at: string;
    end_at: string;
  };
  points: ApiTimelinePoint[];
  updated_at: string;
};

type ApiShareCard = {
  headline: string;
};

type ApiStaleness = {
  refreshed_at: string;
  stale_after: string;
  source_watermark: string;
  is_stale: boolean;
  partial_profile_available: boolean;
};

type ApiPrivacy = {
  public_profile_enabled: boolean;
  show_exact_prs: boolean;
  show_ai_summaries: boolean;
  show_leaderboard_participation: boolean;
};

type ApiRepositoryVisibility = {
  full_name: string;
  visibility: string;
  reason?: string;
};

type ApiPublicProfileResponse = {
  summary: ApiProfileSummary;
  top_skill_areas?: ApiSkillArea[];
  top_repositories?: ApiRepository[];
  level: ApiLevel;
  badges?: ApiBadge[];
  score_history?: ApiScoreHistoryEntry[];
  timeline: ApiTimeline;
  share_card: ApiShareCard;
  staleness: ApiStaleness;
};

type ApiPrivateProfileResponse = ApiPublicProfileResponse & {
  privacy: ApiPrivacy;
  repository_visibility?: ApiRepositoryVisibility[];
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

type BackedPrivacySettings = Pick<
  PrivacySettings,
  | "publicProfileEnabled"
  | "showExactPRs"
  | "showAiSummaries"
  | "showLeaderboardParticipation"
>;

export async function getPublicProfile(
  username: string,
  preview?: PreviewMode,
): Promise<ProfileViewData | null> {
  if (preview) {
    const mockProfile = await getMockUserProfile(username, preview);
    if (!mockProfile) {
      return null;
    }
    return mockProfileView(mockProfile);
  }

  const response = await fetch(`/api/profile/public/${encodeURIComponent(username)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 404) {
    return null;
  }
  return adaptProfileResponse<ApiPublicProfileResponse>(response, "public");
}

export async function getMyProfile(preview?: PreviewMode): Promise<ProfileViewData> {
  if (preview) {
    const mockProfile = await getMockUserProfile("Ayush3941", preview);
    if (!mockProfile) {
      throw new Error("Mock profile is unavailable.");
    }
    return mockProfileView(mockProfile);
  }

  const response = await fetch("/api/profile/me", {
    cache: "no-store",
    credentials: "same-origin",
  });
  return adaptProfileResponse<ApiPrivateProfileResponse>(response, "private");
}

export async function updateMyProfilePrivacy(
  input: Partial<BackedPrivacySettings>,
): Promise<ProfileViewData> {
  const csrfToken = requireCSRFToken();
  const response = await fetch("/api/profile/me", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({
      public_profile_enabled: input.publicProfileEnabled,
      show_exact_prs: input.showExactPRs,
      show_ai_summaries: input.showAiSummaries,
      show_leaderboard_participation: input.showLeaderboardParticipation,
    }),
  });
  return adaptProfileResponse<ApiPrivateProfileResponse>(response, "private");
}

export async function updateMyProfileRepositoryVisibility(
  fullName: string,
  visibility: RepositoryVisibility["visibility"],
  reason: string,
): Promise<ProfileViewData> {
  const [owner, repo] = splitRepositoryName(fullName);
  const csrfToken = requireCSRFToken();
  const response = await fetch(
    `/api/profile/me/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({
        visibility: visibility.toLowerCase(),
        reason,
      }),
    },
  );
  return adaptProfileResponse<ApiPrivateProfileResponse>(response, "private");
}

async function adaptProfileResponse<T extends ApiPublicProfileResponse | ApiPrivateProfileResponse>(
  response: Response,
  mode: "public" | "private",
): Promise<ProfileViewData> {
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
  const payload = (await response.json()) as T;
  return toProfileViewData(payload, mode);
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `Profile request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || fallback;
  } catch {
    return fallback;
  }
}

function toProfileViewData(
  response: ApiPublicProfileResponse | ApiPrivateProfileResponse,
  mode: "public" | "private",
): ProfileViewData {
  const topSkills = (response.top_skill_areas ?? []).map((skill) => normalizeSkillCategory(skill.key));
  const skillTree = toSkillTree(response.top_skill_areas ?? []);
  const featuredContributions = toFeaturedContributions(response.score_history ?? []);
  const repositories =
    mode === "private" && "repository_visibility" in response
      ? toRepositoryVisibility(response.repository_visibility ?? [])
      : toRepositoryVisibilityFromTopRepos(response.top_repositories ?? []);

  const timelinePoints = response.timeline.points ?? [];
  const lastBucket = timelinePoints[timelinePoints.length - 1];
  const activeBuckets = timelinePoints.filter((point) => point.delta_xp > 0).length;
  const totalBuckets = Math.max(1, timelinePoints.length);

  const user: UserProfile = {
    username: response.summary.handle,
    displayName: response.summary.display_name,
    title: response.level.label,
    avatarUrl:
      response.summary.avatar_url ||
      `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(response.summary.handle)}`,
    bio: response.summary.bio || response.summary.strength_summary,
    gitRankScore: response.summary.total_xp,
    mergedPrCount: response.summary.merged_pull_requests,
    reviewedPrCount: 0,
    bestCategory: topSkills[0] ?? "Backend",
    consistencyScore: Math.round((activeBuckets / totalBuckets) * 100),
    strongestSignals: topSkills,
    topSkills,
    level: {
      currentLevel: response.level.current_level,
      title: response.level.label,
      currentXp: response.level.current_xp,
      nextLevelXp: response.level.next_level_xp,
      rankTier: response.level.rank_tier as UserProfile["level"]["rankTier"],
    },
    skillTree,
    contributions: [],
    badges: toBadges(response.badges ?? []),
    quests: [],
    scoreChanges: featuredContributions.slice(0, 5).map((item) => ({
      label: `${item.owner}/${item.repo} #${item.number}`,
      deltaXp: item.xpEarned,
      type: item.xpEarned >= 0 ? "gain" : "penalty",
      reason: item.summary,
    })),
    xpTimeline: timelinePoints.map((point) => ({
      label: formatShortDate(point.bucket_start),
      xp: point.total_xp,
    })),
    syncStatus: {
      state: response.staleness.is_stale ? "stale" : "synced",
      lastSyncedAt: response.staleness.refreshed_at,
      currentStep: response.staleness.is_stale
        ? "Profile snapshot is older than the refresh window"
        : "Profile snapshot is current",
      progress: 100,
      partialProfileAvailable: response.staleness.partial_profile_available,
    },
    weeklyXp: lastBucket?.delta_xp ?? 0,
    leaguePosition: 0,
    movement: 0,
    repositories,
    privacy: toPrivacySettings(
      "privacy" in response ? response.privacy : undefined,
    ),
  };

  return {
    user,
    featuredContributions,
    topRepositories: toTopRepositories(response.top_repositories ?? []),
    shareHeadline: response.share_card.headline,
    trendWindowLabel: response.timeline.window.label,
    refreshedAt: response.staleness.refreshed_at,
    isStale: response.staleness.is_stale,
    partialProfileAvailable: response.staleness.partial_profile_available,
  };
}

function mockProfileView(user: UserProfile): ProfileViewData {
  return {
    user,
    featuredContributions: prAnalyses.slice(0, 5).map((report) => ({
      id: report.contribution.id,
      owner: report.contribution.owner,
      repo: report.contribution.repo,
      number: report.contribution.number,
      title: report.contribution.title,
      summary: report.contribution.aiSummary,
      xpEarned: report.contribution.xpEarned,
      happenedAt: report.contribution.mergedAt,
    })),
    topRepositories: user.repositories.map((repository) => {
      const [owner, repo] = splitRepositoryName(repository.name);
      return {
        name: repository.name,
        owner,
        repo,
        totalXp: user.gitRankScore,
        contributionCount: user.contributions.filter(
          (contribution) => `${contribution.owner}/${contribution.repo}` === repository.name,
        ).length,
        visibility: repository.visibility,
        primarySkill: user.topSkills[0],
      };
    }),
    shareHeadline: user.title,
    trendWindowLabel: "Last 6 weeks",
    refreshedAt: user.syncStatus.lastSyncedAt ?? new Date().toISOString(),
    isStale: user.syncStatus.state === "stale",
    partialProfileAvailable: user.syncStatus.partialProfileAvailable,
  };
}

function toSkillTree(skills: ApiSkillArea[]): SkillNode[] {
  return skills.map((skill) => ({
    category: normalizeSkillCategory(skill.key),
    score: Math.max(1, Math.round(skill.percentage)),
    delta: 0,
    note: skill.summary || `${humanizeKey(skill.key)} contributes ${skill.total_xp} XP.`,
  }));
}

function toFeaturedContributions(entries: ApiScoreHistoryEntry[]): FeaturedContribution[] {
  return entries
    .filter((entry) => entry.delta_xp > 0 && entry.pull_request)
    .slice(0, 5)
    .map((entry) => {
      const [owner, repo] = splitRepositoryName(entry.pull_request?.repository || "");
      return {
        id: entry.event_id,
        owner,
        repo,
        number: entry.pull_request?.number ?? 0,
        title: entry.pull_request?.title || "Contribution",
        summary:
          entry.explanation?.find((line) => line.trim().length > 0) ||
          "Exact contribution details are limited to verified score evidence.",
        xpEarned: entry.delta_xp,
        happenedAt: entry.created_at,
      };
    });
}

function toBadges(source: ApiBadge[]): Badge[] {
  return source.map((badge) => ({
    id: badge.key,
    name: badge.name,
    rarity: badgeRarityForKey(badge.key),
    description: badge.description || "Awarded from verified contribution evidence.",
    unlockCondition: "Earned through verified GitRank scoring evidence.",
    icon: badgeIconForKey(badge.key),
    unlocked: true,
    earnedAt: badge.awarded_at,
    evidencePrIds: [],
  }));
}

function toTopRepositories(source: ApiRepository[]): ProfileRepositorySummary[] {
  return source.map((repository) => ({
    name: repository.full_name,
    owner: repository.owner,
    repo: repository.name,
    totalXp: repository.total_xp,
    contributionCount: repository.contribution_count,
    visibility: normalizeVisibility(repository.visibility),
    primarySkill: repository.primary_skill
      ? normalizeSkillCategory(repository.primary_skill)
      : undefined,
  }));
}

function toRepositoryVisibility(source: ApiRepositoryVisibility[]): RepositoryVisibility[] {
  return source.map((repository) => ({
    name: repository.full_name,
    tracked: true,
    visibility: normalizeVisibility(repository.visibility),
    reason:
      repository.reason ||
      (normalizeVisibility(repository.visibility) === "Public"
        ? "Visible on the public profile."
        : "Hidden from the public profile."),
  }));
}

function toRepositoryVisibilityFromTopRepos(source: ApiRepository[]): RepositoryVisibility[] {
  return source.map((repository) => ({
    name: repository.full_name,
    tracked: true,
    visibility: normalizeVisibility(repository.visibility),
    reason: `${repository.contribution_count} scored contributions, ${repository.total_xp} XP.`,
  }));
}

function toPrivacySettings(source?: ApiPrivacy): PrivacySettings {
  return {
    publicProfileEnabled: source?.public_profile_enabled ?? true,
    showExactPRs: source?.show_exact_prs ?? true,
    showAiSummaries: source?.show_ai_summaries ?? true,
    showLeaderboardParticipation: source?.show_leaderboard_participation ?? true,
    badgeUnlockedNotifications: false,
    levelUpNotifications: false,
    weeklyReportNotifications: false,
  };
}

function badgeRarityForKey(key: string): BadgeRarity {
  const normalized = key.toLowerCase();
  if (normalized.includes("mythic")) return "Mythic";
  if (normalized.includes("legend")) return "Legendary";
  if (normalized.includes("epic")) return "Epic";
  if (normalized.includes("rare")) return "Rare";
  if (normalized.includes("review") || normalized.includes("security")) return "Epic";
  return "Uncommon";
}

function badgeIconForKey(key: string): BadgeIcon {
  const normalized = key.toLowerCase();
  if (normalized.includes("docs")) return "scroll";
  if (normalized.includes("test")) return "flask";
  if (normalized.includes("review")) return "messages";
  if (normalized.includes("security")) return "lock";
  if (normalized.includes("infra")) return "wrench";
  if (normalized.includes("backend")) return "server";
  if (normalized.includes("consistent")) return "calendar";
  return "shield";
}

function normalizeSkillCategory(value: string): SkillCategory {
  const normalized = value.trim().toLowerCase();
  const mapped: Record<string, SkillCategory> = {
    architecture: "Architecture",
    backend: "Backend",
    bugfix: "Backend",
    bug_fix: "Backend",
    devops: "DevOps",
    docs: "Documentation",
    documentation: "Documentation",
    frontend: "Frontend",
    infrastructure: "DevOps",
    performance: "Performance",
    review: "Review",
    reviews: "Review",
    security: "Security",
    testing: "Testing",
    tests: "Testing",
  };
  return mapped[normalized] ?? "Backend";
}

function normalizeVisibility(value: string): RepositoryVisibility["visibility"] {
  return value.trim().toLowerCase() === "hidden" ? "Hidden" : "Public";
}

function humanizeKey(value: string): string {
  return value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

function splitRepositoryName(fullName: string): [string, string] {
  const [owner = "unknown", repo = "repo"] = fullName.split("/", 2);
  return [owner, repo];
}

function requireCSRFToken(): string {
  const value = readCookie(DEFAULT_CSRF_COOKIE_NAME);
  if (!value) {
    throw new Error("Missing CSRF cookie. Refresh the session and try again.");
  }
  return value;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const prefix = `${encodeURIComponent(name)}=`;
  for (const entry of document.cookie.split(";")) {
    const trimmed = entry.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return null;
}
