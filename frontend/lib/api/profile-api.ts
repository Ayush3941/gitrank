import type {
  Badge,
  BadgeIcon,
  BadgeRarity,
  Contribution,
  FeaturedContribution,
  LeaderboardSeason,
  PrivacySettings,
  ProfileRepositorySummary,
  ProfileViewData,
  RepositoryVisibility,
  SyncStatus,
  SkillCategory,
  SkillNode,
  UserProfile,
} from "@/types/gitrank";
import {
  type ApiPRReportResponse,
  toPullRequestAnalysis,
} from "@/lib/api/pr-report-api";
import { frontendPolicy } from "@/lib/runtime/frontend-policy";
import {
  nextRankTier,
  normalizeRankTier,
} from "@/lib/runtime/rank-tier-policy";
import { normalizeSkillCategory as normalizeRuntimeSkillCategory } from "@/lib/runtime/skill-category-policy";
import { leaderboardSeasonPolicy } from "@/lib/runtime/leaderboard-season-policy";
import {
  normalizePRCategory,
} from "@/lib/runtime/pr-category-policy";
import { contributionDisplayConfig } from "@/lib/runtime/contribution-display-config";
import {
  formatMonthDay,
  formatPluralCount,
  formatRatioPercent,
  formatXpLabel,
  toRatioPercent,
} from "@/lib/formatters";
import type { PullRequestAnalysis } from "@/types/gitrank";

const DEFAULT_CSRF_COOKIE_NAME = frontendPolicy.csrfCookieName;

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
  evidence_source?: "deterministic" | "ai_assisted" | "mixed" | "unknown";
  confidence?: number;
  evidence_state?: "fresh" | "stale" | "partial";
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
  rarity?: string;
  icon?: string;
  description?: string;
  awarded_at: string;
  evidence?: Record<string, unknown>;
};

type ApiPullRequestReference = {
  repository: string;
  number: number;
  title?: string;
  state?: string;
  merged?: boolean;
};

type ApiScoreHistoryEntry = {
  event_id: string;
  event_type: string;
  category?: string;
  delta_xp: number;
  created_at: string;
  score_version?: string;
  formula_version?: string;
  pull_request_id?: string;
  analysis_id?: string;
  evidence_state?: "complete" | "partial";
  evidence_missing?: string[];
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
  reduced_gamification?: boolean;
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
  score_history_cap?: number;
  high_xp_threshold?: number;
  timeline: ApiTimeline;
  share_card: ApiShareCard;
  staleness: ApiStaleness;
};

type ApiPrivateProfileResponse = ApiPublicProfileResponse & {
  privacy: ApiPrivacy;
  repository_visibility?: ApiRepositoryVisibility[];
  recent_pr_reports?: ApiPRReportResponse[];
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
  | "reducedGamification"
>;

export async function getPublicProfile(username: string): Promise<ProfileViewData | null> {
  const response = await fetch(`/api/profile/public/${encodeURIComponent(username)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 404) {
    return null;
  }
  return adaptProfileResponse<ApiPublicProfileResponse>(response, "public");
}

export async function getMyProfile(): Promise<ProfileViewData> {
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
      reduced_gamification: input.reducedGamification,
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
  const privacy = toPrivacySettings(
    "privacy" in response ? response.privacy : undefined,
  );
  const showAiSummaries = privacy.showAiSummaries;
  const topSkills = uniqueSkillCategories((response.top_skill_areas ?? []).map((skill) => normalizeSkillCategory(skill.key)));
  const skillTree = toSkillTree(response.top_skill_areas ?? []);
  const featuredContributions = toFeaturedContributions(
    response.score_history ?? [],
    showAiSummaries,
  );
  const recentReportsRaw =
    "recent_pr_reports" in response
      ? (response.recent_pr_reports ?? []).map(toPullRequestAnalysis)
      : [];
  const recentReports = redactReportSummaries(recentReportsRaw, showAiSummaries);
  const contributions = mergeContributionDetails(
    toContributions(response.score_history ?? [], showAiSummaries),
    recentReports,
    showAiSummaries,
  );
  const reviewedPrCount = contributions.filter((row) => row.maintainerReviewed).length;
  const scoringVersion = scoreVersionFromHistory(response.score_history ?? []);
  const repositories =
    mode === "private" && "repository_visibility" in response
      ? toRepositoryVisibility(response.repository_visibility ?? [])
      : toRepositoryVisibilityFromTopRepos(response.top_repositories ?? []);

  const timelinePoints = response.timeline.points ?? [];
  const lastBucket = timelinePoints[timelinePoints.length - 1];
  const activeBuckets = timelinePoints.filter((point) => point.delta_xp > 0).length;
  const totalBuckets = Math.max(1, timelinePoints.length);
  const hasEvidence = hasProfileEvidence(response);
  const syncState = deriveProfileSyncState(response.staleness, hasEvidence);

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
    reviewedPrCount,
    bestCategory: topSkills[0] ?? "Backend",
    consistencyScore: toRatioPercent(activeBuckets / totalBuckets),
    strongestSignals: topSkills,
    topSkills,
    level: {
      currentLevel: response.level.current_level,
      title: response.level.label,
      currentXp: response.level.current_xp,
      nextLevelXp: response.level.next_level_xp,
      rankTier: normalizeRankTier(response.level.rank_tier),
    },
    rankProgress: {
      season: seasonFromRefreshedAt(response.staleness.refreshed_at, scoringVersion),
      currentTier: normalizeRankTier(response.level.rank_tier),
      nextTier: nextRankTier(normalizeRankTier(response.level.rank_tier)),
      seasonXp: lastBucket?.delta_xp ?? 0,
      xpToNextTier: Math.max(0, response.level.next_level_xp - response.level.current_xp),
      promotionCutoffRank: leaderboardSeasonPolicy.promotionCutoffRank,
      safetyCutoffRank: leaderboardSeasonPolicy.safetyCutoffRank,
      evidenceSignals: topSkills.length
        ? topSkills.slice(0, 3).map((skill) => `${skill} evidence`)
        : ["Verified profile snapshot"],
    },
    skillTree,
    contributions,
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
      state: syncState,
      lastSyncedAt: response.staleness.refreshed_at,
      currentStep: syncState === "stale"
        ? "Profile snapshot is older than the refresh window"
        : syncState === "partially_synced"
          ? "Profile snapshot refreshed but scored PR evidence is still empty"
          : "Profile snapshot is current",
      progress: syncState === "partially_synced" ? 75 : 100,
      partialProfileAvailable: response.staleness.partial_profile_available,
    },
    weeklyXp: lastBucket?.delta_xp ?? 0,
    leaguePosition: 0,
    movement: 0,
    repositories,
    privacy,
  };

  return {
    user,
    featuredContributions,
    topRepositories: toTopRepositories(response.top_repositories ?? []),
    recentReports,
    scoreHistoryCap: Math.max(1, response.score_history_cap ?? contributionDisplayConfig.renderHardCap),
    highXPThreshold: Math.max(1, response.high_xp_threshold ?? contributionDisplayConfig.highXPThreshold),
    shareHeadline: response.share_card.headline,
    trendWindowLabel: response.timeline.window.label,
    refreshedAt: response.staleness.refreshed_at,
    isStale: response.staleness.is_stale,
    partialProfileAvailable: response.staleness.partial_profile_available,
  };
}

function toSkillTree(skills: ApiSkillArea[]): SkillNode[] {
  const grouped = new Map<SkillCategory, { node: SkillNode; count: number }>();
  for (const skill of skills) {
    const category = normalizeSkillCategory(skill.key);
    const score = Math.max(1, Math.round(skill.percentage));
    const existing = grouped.get(category);
    if (!existing) {
      grouped.set(category, {
        count: 1,
        node: {
          category,
          score,
          delta: 0,
          note: skillNote(skill),
          evidenceSource: skill.evidence_source,
          confidence: skill.confidence,
          evidenceState: skill.evidence_state,
        },
      });
      continue;
    }
    existing.count += 1;
    existing.node.score = Math.min(100, existing.node.score + score);
    existing.node.confidence = maxConfidence(existing.node.confidence, skill.confidence);
    existing.node.evidenceSource = mergedEvidenceSource(existing.node.evidenceSource, skill.evidence_source);
    existing.node.evidenceState = mergedEvidenceState(existing.node.evidenceState, skill.evidence_state);
    if (typeof skill.confidence === "number" && Number.isFinite(skill.confidence)) {
      existing.node.note = skillNote(skill);
    }
  }
  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry.node,
      note:
        entry.count > 1
          ? `${entry.node.note} Aggregated from ${entry.count} contribution signals.`
          : entry.node.note,
    }))
    .sort((left, right) => right.score - left.score);
}

function skillNote(skill: ApiSkillArea): string {
  const base =
    skill.summary || `${humanizeKey(skill.key)} contributes ${formatXpLabel(skill.total_xp)}.`;
  const source = readableEvidenceSource(skill.evidence_source);
  const confidence =
    typeof skill.confidence === "number" && skill.confidence > 0
      ? `, confidence ${formatRatioPercent(skill.confidence)}`
      : "";
  const state =
    skill.evidence_state && skill.evidence_state !== "fresh"
      ? `, ${skill.evidence_state} evidence`
      : "";
  return `${base} Evidence source: ${source}${confidence}${state}.`;
}

function readableEvidenceSource(value?: string): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "unknown") {
    return "deterministic snapshot";
  }
  return normalized.replace(/_/g, " ");
}

function toFeaturedContributions(
  entries: ApiScoreHistoryEntry[],
  showAiSummaries: boolean,
): FeaturedContribution[] {
  return collapseScoreHistoryByPullRequest(entries)
    .filter((entry) => entry.delta_xp > 0 && entry.pull_request)
    .slice(0, 5)
    .map((entry) => {
      const [owner, repo] = splitRepositoryName(entry.pull_request?.repository || "");
      return {
        id: entry.event_id,
        scoreEventId: entry.event_id,
        scoreVersion: entry.score_version,
        formulaVersion: entry.formula_version,
        pullRequestId: entry.pull_request_id,
        analysisId: entry.analysis_id,
        evidenceState: entry.evidence_state,
        evidenceMissing: entry.evidence_missing,
        owner,
        repo,
        number: entry.pull_request?.number ?? 0,
        title: entry.pull_request?.title || "Contribution",
        status: deriveContributionStatus(entry.pull_request),
        summary:
          showAiSummaries
            ? bestExplanationLine(entry.explanation) ||
              "Exact contribution details are limited to verified score evidence."
            : REDACTED_AI_SUMMARY,
        xpEarned: entry.delta_xp,
        happenedAt: entry.created_at,
      };
    });
}

function toContributions(
  entries: ApiScoreHistoryEntry[],
  showAiSummaries: boolean,
): Contribution[] {
  return collapseScoreHistoryByPullRequest(entries)
    .filter((entry) => entry.pull_request)
    .map((entry) => {
      const [owner, repo] = splitRepositoryName(entry.pull_request?.repository || "");
      return {
        id: entry.event_id,
        scoreEventId: entry.event_id,
        scoreVersion: entry.score_version,
        formulaVersion: entry.formula_version,
        pullRequestId: entry.pull_request_id,
        analysisId: entry.analysis_id,
        evidenceState: entry.evidence_state,
        evidenceMissing: entry.evidence_missing,
        owner,
        repo,
        number: entry.pull_request?.number ?? 0,
        title: entry.pull_request?.title || "Contribution",
        status: deriveContributionStatus(entry.pull_request),
        category: normalizePRCategory(entry.category ?? ""),
        difficultyScore: 0,
        impactScore: 0,
        reviewDepthScore: 0,
        testSignalScore: 0,
        repoWeight: 1,
        antiSpamMultiplier: 1,
        xpEarned: entry.delta_xp,
        additions: 0,
        deletions: 0,
        changedFilesCount: 0,
        mergedAt: entry.created_at,
        maintainerReviewed: false,
        linkedIssue: false,
        ciPassed: false,
        aiSummary: showAiSummaries
          ? bestExplanationLine(entry.explanation) ||
            "Profile snapshot evidence does not include detailed PR analysis metrics yet."
          : REDACTED_AI_SUMMARY,
        evidenceSignals: entry.explanation ?? [],
      };
    });
}

function mergeContributionDetails(
  contributions: Contribution[],
  reports: PullRequestAnalysis[],
  showAiSummaries: boolean,
): Contribution[] {
  if (reports.length === 0) {
    return contributions;
  }

  const reportByKey = new Map<string, PullRequestAnalysis>();
  for (const report of reports) {
    reportByKey.set(
      contributionKey(
        report.contribution.owner,
        report.contribution.repo,
        report.contribution.number,
      ),
      report,
    );
  }

  return contributions.map((row) => {
    const report = reportByKey.get(contributionKey(row.owner, row.repo, row.number));
    if (!report) {
      return row;
    }

    const live = report.contribution;
    return {
      ...row,
      status: live.status,
      category: live.category,
      analysisId: live.analysisId || row.analysisId,
      evidenceState:
        report.evidenceState.status === "complete" ? "complete" : "partial",
      reportEvidenceStatus: report.evidenceState.status,
      reportAnalysisSource: report.evidenceState.analysisSource,
      reportStale: report.evidenceState.stale,
      difficultyScore: live.difficultyScore,
      impactScore: live.impactScore,
      reviewDepthScore: live.reviewDepthScore,
      testSignalScore: live.testSignalScore,
      repoWeight: live.repoWeight,
      antiSpamMultiplier: live.antiSpamMultiplier,
      additions: live.additions,
      deletions: live.deletions,
      changedFilesCount: live.changedFilesCount,
      maintainerReviewed: live.maintainerReviewed,
      linkedIssue: live.linkedIssue,
      ciPassed: live.ciPassed,
      aiSummary: showAiSummaries ? live.aiSummary || row.aiSummary : REDACTED_AI_SUMMARY,
      evidenceSignals:
        live.evidenceSignals.length > 0 ? live.evidenceSignals : row.evidenceSignals,
    };
  });
}

function redactReportSummaries(
  reports: PullRequestAnalysis[],
  showAiSummaries: boolean,
): PullRequestAnalysis[] {
  if (showAiSummaries) {
    return reports;
  }
  return reports.map((report) => ({
    ...report,
    contribution: {
      ...report.contribution,
      aiSummary: REDACTED_AI_SUMMARY,
    },
  }));
}

const REDACTED_AI_SUMMARY =
  "AI summaries are hidden by your current privacy setting.";

function collapseScoreHistoryByPullRequest(
  entries: ApiScoreHistoryEntry[],
): ApiScoreHistoryEntry[] {
  const collapsedOrder: string[] = [];
  const collapsedByKey = new Map<string, ApiScoreHistoryEntry>();

  for (const entry of entries) {
    if (!entry.pull_request) {
      continue;
    }
    const [owner, repo] = splitRepositoryName(entry.pull_request.repository || "");
    const key = contributionKey(owner, repo, entry.pull_request.number);
    const existing = collapsedByKey.get(key);

    if (!existing) {
      collapsedByKey.set(key, {
        ...entry,
        explanation: entry.explanation ? [...entry.explanation] : [],
        evidence_missing: entry.evidence_missing ? [...entry.evidence_missing] : [],
      });
      collapsedOrder.push(key);
      continue;
    }

    existing.delta_xp += entry.delta_xp;
    existing.explanation = mergeUniqueStrings(existing.explanation, entry.explanation);
    existing.evidence_missing = mergeUniqueStrings(existing.evidence_missing, entry.evidence_missing);
    existing.evidence_state = strongestEvidenceState(existing.evidence_state, entry.evidence_state);

    if (isNewerTimestamp(entry.created_at, existing.created_at)) {
      existing.event_id = entry.event_id;
      existing.event_type = entry.event_type;
      existing.category = entry.category || existing.category;
      existing.created_at = entry.created_at;
      existing.score_version = entry.score_version || existing.score_version;
      existing.formula_version = entry.formula_version || existing.formula_version;
      existing.pull_request_id = entry.pull_request_id || existing.pull_request_id;
      existing.analysis_id = entry.analysis_id || existing.analysis_id;
      existing.pull_request = entry.pull_request || existing.pull_request;
      continue;
    }

    if (!existing.score_version && entry.score_version) {
      existing.score_version = entry.score_version;
    }
    if (!existing.formula_version && entry.formula_version) {
      existing.formula_version = entry.formula_version;
    }
    if (!existing.category && entry.category) {
      existing.category = entry.category;
    }
    if (!existing.pull_request_id && entry.pull_request_id) {
      existing.pull_request_id = entry.pull_request_id;
    }
    if (!existing.analysis_id && entry.analysis_id) {
      existing.analysis_id = entry.analysis_id;
    }
  }

  return collapsedOrder
    .map((key) => collapsedByKey.get(key))
    .filter((entry): entry is ApiScoreHistoryEntry => Boolean(entry));
}

function mergeUniqueStrings(base?: string[], next?: string[]): string[] {
  const merged = new Set<string>();
  for (const value of base ?? []) {
    const normalized = value.trim();
    if (normalized.length > 0) {
      merged.add(normalized);
    }
  }
  for (const value of next ?? []) {
    const normalized = value.trim();
    if (normalized.length > 0) {
      merged.add(normalized);
    }
  }
  return Array.from(merged);
}

function bestExplanationLine(lines?: string[]): string {
  const candidate = lines?.find((line) => line.trim().length > 0) ?? "";
  return sanitizeExplanationLine(candidate);
}

function deriveContributionStatus(
  pullRequest: ApiPullRequestReference | undefined,
): Contribution["status"] {
  if (pullRequest?.merged) {
    return "merged";
  }
  const state = (pullRequest?.state ?? "").trim().toLowerCase();
  if (state === "open") {
    return "open";
  }
  if (state === "closed") {
    return "closed";
  }
  // Unknown lifecycle metadata must not imply merged evidence.
  return "open";
}

function sanitizeExplanationLine(line: string): string {
  let value = line.trim();
  if (!value) {
    return "";
  }
  const lower = value.toLowerCase();
  if (lower.startsWith("fallback_reason=")) {
    return "Deterministic summary is shown while AI enrichment is unavailable.";
  }
  if (lower.startsWith("summary=[")) {
    const endBracket = value.lastIndexOf("]");
    if (endBracket > "summary=[".length) {
      value = value.slice("summary=[".length, endBracket);
    } else {
      value = value.slice("summary=[".length);
    }
  }
  value = value
    .replace(/\bscore version\s+[a-z0-9._-]+/gi, "Deterministic scoring replay")
    .replace(/\bfinal xp\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) {
    return "";
  }
  const sentence = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function strongestEvidenceState(
  left?: ApiScoreHistoryEntry["evidence_state"],
  right?: ApiScoreHistoryEntry["evidence_state"],
): ApiScoreHistoryEntry["evidence_state"] {
  if (left === "complete" || right === "complete") {
    return "complete";
  }
  if (left === "partial" || right === "partial") {
    return "partial";
  }
  return left ?? right;
}

function isNewerTimestamp(candidate: string, baseline: string): boolean {
  const candidateMillis = Date.parse(candidate);
  const baselineMillis = Date.parse(baseline);
  if (!Number.isNaN(candidateMillis) && !Number.isNaN(baselineMillis)) {
    return candidateMillis > baselineMillis;
  }
  return candidate > baseline;
}

function contributionKey(owner: string, repo: string, number: number): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}#${number}`;
}

function toBadges(source: ApiBadge[]): Badge[] {
  return source.map((badge) => ({
    id: badge.key,
    name: badge.name,
    rarity: normalizeBadgeRarity(badge.rarity),
    description: badge.description || "Awarded from verified contribution evidence.",
    unlockCondition: "Earned through verified GitRank scoring evidence.",
    icon: normalizeBadgeIcon(badge.icon),
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
    reason: `${formatPluralCount(repository.contribution_count, "scored contribution")}, ${formatXpLabel(repository.total_xp)}.`,
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
    reducedGamification: source?.reduced_gamification ?? false,
  };
}

function seasonFromRefreshedAt(refreshedAt: string, scoringVersion: string): LeaderboardSeason {
  const refreshed = Number.isNaN(Date.parse(refreshedAt)) ? new Date() : new Date(refreshedAt);
  const day = refreshed.getUTCDay();
  const distanceFromMonday = (day + 6) % 7;
  const startsAt = new Date(refreshed);
  startsAt.setUTCDate(refreshed.getUTCDate() - distanceFromMonday);
  startsAt.setUTCHours(0, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(startsAt.getUTCDate() + 6);
  endsAt.setUTCHours(23, 59, 59, 999);

  return {
    id: `weekly-${startsAt.toISOString().slice(0, 10)}`,
    name: `Weekly arena ${formatShortDate(startsAt.toISOString())}`,
    windowLabel: `${formatShortDate(startsAt.toISOString())} - ${formatShortDate(endsAt.toISOString())}`,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "Active",
    scoringVersion,
    promotionRule: leaderboardSeasonPolicy.promotionRule,
    resetRule: leaderboardSeasonPolicy.resetRule,
    promotionCutoffRank: leaderboardSeasonPolicy.promotionCutoffRank,
    safetyCutoffRank: leaderboardSeasonPolicy.safetyCutoffRank,
    explanation:
      "Season progress is derived from the latest profile snapshot and current score-event window.",
  };
}

function scoreVersionFromHistory(entries: ApiScoreHistoryEntry[]): string {
  for (const entry of entries) {
    if (entry.score_version) {
      return entry.score_version;
    }
    const line = entry.explanation?.find((item) => item.toLowerCase().startsWith("score version "));
    if (line) {
      const parsed = line.replace(/^score version\s+/i, "").trim();
      if (parsed.length > 0) {
        return parsed;
      }
    }
  }
  return frontendPolicy.scoreVersionFallback;
}

function normalizeBadgeRarity(value?: string): BadgeRarity {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "common":
      return "Common";
    case "rare":
      return "Rare";
    case "epic":
      return "Epic";
    case "legendary":
      return "Legendary";
    case "mythic":
      return "Mythic";
    case "uncommon":
    default:
      return "Uncommon";
  }
}

function normalizeBadgeIcon(value?: string): BadgeIcon {
  const normalized = (value ?? "").trim().toLowerCase();
  switch (normalized) {
    case "bolt":
    case "book":
    case "calendar":
    case "crown":
    case "flask":
    case "lock":
    case "messages":
    case "scroll":
    case "server":
    case "shield":
    case "wrench":
      return normalized;
    default:
      return "shield";
  }
}

function normalizeSkillCategory(value: string): SkillCategory {
  return normalizeRuntimeSkillCategory(value, "Architecture");
}

function uniqueSkillCategories(skills: SkillCategory[]): SkillCategory[] {
  const seen = new Set<SkillCategory>();
  const output: SkillCategory[] = [];
  for (const skill of skills) {
    if (seen.has(skill)) {
      continue;
    }
    seen.add(skill);
    output.push(skill);
  }
  return output;
}

function maxConfidence(current?: number, next?: number): number | undefined {
  const left = typeof current === "number" && Number.isFinite(current) ? current : undefined;
  const right = typeof next === "number" && Number.isFinite(next) ? next : undefined;
  if (left === undefined) return right;
  if (right === undefined) return left;
  return Math.max(left, right);
}

function mergedEvidenceSource(
  left?: "deterministic" | "ai_assisted" | "mixed" | "unknown",
  right?: "deterministic" | "ai_assisted" | "mixed" | "unknown",
): "deterministic" | "ai_assisted" | "mixed" | "unknown" {
  if (!left) return right ?? "unknown";
  if (!right) return left;
  if (left === right) return left;
  return "mixed";
}

function mergedEvidenceState(
  left?: "fresh" | "stale" | "partial",
  right?: "fresh" | "stale" | "partial",
): "fresh" | "stale" | "partial" {
  if (!left) return right ?? "partial";
  if (!right) return left;
  if (left === "stale" || right === "stale") return "stale";
  if (left === "partial" || right === "partial") return "partial";
  return "fresh";
}

function hasProfileEvidence(response: ApiPublicProfileResponse | ApiPrivateProfileResponse): boolean {
  if ((response.summary.merged_pull_requests ?? 0) > 0) {
    return true;
  }
  if ((response.score_history?.some((entry) => {
    if (!entry.pull_request || (entry.pull_request.number ?? 0) <= 0) {
      return false;
    }
    const eventType = (entry.event_type ?? "").trim().toLowerCase();
    if (eventType !== "score.computed") {
      return false;
    }
    return entry.delta_xp > 0;
  }) ?? false)) {
    return true;
  }
  if ((response.top_repositories?.some((repository) => (
    repository.merged_pull_requests > 0 ||
    (repository.contribution_count > 0 && repository.total_xp > 0)
  )) ?? false)) {
    return true;
  }
  if (
    "recent_pr_reports" in response &&
    (response.recent_pr_reports?.some((report) => (
      (report.contribution?.number ?? 0) > 0 &&
      (report.contribution?.xp_earned ?? 0) > 0
    )) ?? false)
  ) {
    return true;
  }
  return false;
}

function deriveProfileSyncState(
  staleness: ApiStaleness,
  hasEvidence: boolean,
): SyncStatus["state"] {
  if (staleness.is_stale) {
    return "stale";
  }
  if (!hasEvidence) {
    return "partially_synced";
  }
  if (staleness.partial_profile_available && !hasUsableSourceWatermark(staleness.source_watermark)) {
    return "partially_synced";
  }
  return "synced";
}

function hasUsableSourceWatermark(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return parsed > 0;
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
  return formatMonthDay(value);
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
