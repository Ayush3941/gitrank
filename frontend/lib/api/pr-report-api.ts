import type {
  Contribution,
  PRCategory,
  PRBadgeUnlock,
  PREvidenceState,
  PullRequestAnalysis,
  ScoreBreakdown,
  ScoreComponent,
  SkillCategory,
} from "@/types/gitrank";

export type ApiPRReportContribution = {
  id: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  status: string;
  category: string;
  difficulty_score: number;
  impact_score: number;
  review_depth_score: number;
  test_signal_score: number;
  repo_weight: number;
  anti_spam_multiplier: number;
  xp_earned: number;
  additions: number;
  deletions: number;
  changed_files_count: number;
  merged_at: string;
  maintainer_reviewed: boolean;
  linked_issue: boolean;
  ci_passed: boolean;
  ai_summary: string;
  evidence_signals?: string[];
};

export type ApiScoreBreakdown = {
  label: string;
  delta_xp: number;
  type: string;
  reason: string;
};

export type ApiScoreComponent = {
  key: string;
  label: string;
  value: number;
  display_value: string;
  source: string;
  reason: string;
};

export type ApiPRReportBadgeUnlock = {
  key: string;
  name: string;
  description?: string;
  awarded_at: string;
  rule?: string;
  rule_version?: string;
  evidence_signals?: string[];
  evidence_pr_ids?: string[];
};

export type ApiPRReportSuggestedQuest = {
  id: string;
  title: string;
  description: string;
  status: string;
  weak_area_target?: string;
  why_recommended: string;
  evidence_signals?: string[];
};

export type ApiPRReportEvidenceState = {
  status: PREvidenceState["status"];
  reasons?: string[];
  missing_evidence?: string[];
  analysis_source?: string;
  analysis_confidence?: number;
  deterministic_only?: boolean;
  ai_fallback?: boolean;
  rate_limited?: boolean;
  stale?: boolean;
};

export type ApiPRReportResponse = {
  contribution: ApiPRReportContribution;
  base_value: number;
  merged_bonus: number;
  review_bonus: number;
  test_bonus: number;
  repo_bonus: number;
  ai_confidence: number;
  penalties?: ApiScoreBreakdown[];
  score_components?: ApiScoreComponent[];
  badge_unlocks?: ApiPRReportBadgeUnlock[];
  suggested_quest_id: string;
  suggested_quest?: ApiPRReportSuggestedQuest;
  evidence_state?: ApiPRReportEvidenceState;
};

type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getLivePrReport(
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestAnalysis | null> {
  const response = await fetch(
    `/api/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(String(number))}/report`,
    {
      cache: "no-store",
      credentials: "same-origin",
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  const payload = (await response.json()) as ApiPRReportResponse;
  return toPullRequestAnalysis(payload);
}

export function toPullRequestAnalysis(
  report: ApiPRReportResponse,
): PullRequestAnalysis {
  return {
    contribution: toContribution(report.contribution),
    baseValue: report.base_value,
    mergedBonus: report.merged_bonus,
    reviewBonus: report.review_bonus,
    testBonus: report.test_bonus,
    repoBonus: report.repo_bonus,
    aiConfidence: report.ai_confidence,
    penalties: (report.penalties ?? []).map(toScoreBreakdown),
    scoreComponents: (report.score_components ?? []).map(toScoreComponent),
    badgeUnlocks: (report.badge_unlocks ?? []).map(toBadgeUnlock),
    suggestedQuestId: report.suggested_quest_id,
    evidenceState: toEvidenceState(report.evidence_state),
    suggestedQuest: report.suggested_quest
      ? {
          id: report.suggested_quest.id,
          title: report.suggested_quest.title,
          description: report.suggested_quest.description,
          status: report.suggested_quest.status,
          weakAreaTarget: report.suggested_quest.weak_area_target
            ? normalizeSkillCategory(report.suggested_quest.weak_area_target)
            : undefined,
          whyRecommended: report.suggested_quest.why_recommended,
          evidenceSignals: report.suggested_quest.evidence_signals ?? [],
        }
      : undefined,
  };
}

function toEvidenceState(source?: ApiPRReportEvidenceState): PREvidenceState {
  return {
    status: source?.status ?? "incomplete",
    reasons: source?.reasons ?? [],
    missingEvidence: source?.missing_evidence ?? [],
    analysisSource: source?.analysis_source,
    analysisConfidence: source?.analysis_confidence,
    deterministicOnly: source?.deterministic_only ?? false,
    aiFallback: source?.ai_fallback ?? false,
    rateLimited: source?.rate_limited ?? false,
    stale: source?.stale ?? false,
  };
}

function toContribution(source: ApiPRReportContribution): Contribution {
  return {
    id: source.id,
    owner: source.owner,
    repo: source.repo,
    number: source.number,
    title: source.title,
    status: normalizeStatus(source.status),
    category: normalizeCategory(source.category),
    difficultyScore: source.difficulty_score,
    impactScore: source.impact_score,
    reviewDepthScore: source.review_depth_score,
    testSignalScore: source.test_signal_score,
    repoWeight: source.repo_weight,
    antiSpamMultiplier: source.anti_spam_multiplier,
    xpEarned: source.xp_earned,
    additions: source.additions,
    deletions: source.deletions,
    changedFilesCount: source.changed_files_count,
    mergedAt: source.merged_at,
    maintainerReviewed: source.maintainer_reviewed,
    linkedIssue: source.linked_issue,
    ciPassed: source.ci_passed,
    aiSummary: source.ai_summary,
    evidenceSignals: source.evidence_signals ?? [],
  };
}

function toBadgeUnlock(source: ApiPRReportBadgeUnlock): PRBadgeUnlock {
  return {
    key: source.key,
    name: source.name,
    description: source.description,
    awardedAt: source.awarded_at,
    rule: source.rule,
    ruleVersion: source.rule_version,
    evidenceSignals: source.evidence_signals ?? [],
    evidencePrIds: source.evidence_pr_ids ?? [],
  };
}

function toScoreComponent(source: ApiScoreComponent): ScoreComponent {
  return {
    key: source.key,
    label: source.label,
    value: source.value,
    displayValue: source.display_value,
    source: source.source,
    reason: source.reason,
  };
}

function toScoreBreakdown(source: ApiScoreBreakdown): ScoreBreakdown {
  return {
    label: source.label,
    deltaXp: source.delta_xp,
    type: source.type === "penalty" ? "penalty" : "gain",
    reason: source.reason,
  };
}

function normalizeStatus(value: string): Contribution["status"] {
  const normalized = value.trim().toLowerCase();
  if (normalized === "closed") return "closed";
  if (normalized === "open") return "open";
  return "merged";
}

function normalizeCategory(value: string): PRCategory {
  const normalized = value.trim().toLowerCase();
  const mapped: Record<string, PRCategory> = {
    architecture: "Architecture",
    backend: "Backend",
    "bug fix": "Bug Fix",
    bugfix: "Bug Fix",
    documentation: "Documentation",
    docs: "Documentation",
    frontend: "Backend",
    infrastructure: "Infrastructure",
    devops: "Infrastructure",
    performance: "Performance",
    review: "Review",
    security: "Security",
    testing: "Testing",
    tests: "Testing",
  };
  return mapped[normalized] ?? "Backend";
}

function normalizeSkillCategory(value: string): SkillCategory {
  const normalized = value.trim().toLowerCase();
  const mapped: Record<string, SkillCategory> = {
    architecture: "Architecture",
    backend: "Backend",
    documentation: "Documentation",
    docs: "Documentation",
    frontend: "Frontend",
    infrastructure: "DevOps",
    devops: "DevOps",
    performance: "Performance",
    review: "Review",
    security: "Security",
    testing: "Testing",
    tests: "Testing",
  };
  return mapped[normalized] ?? "Backend";
}

async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `PR report request failed with status ${response.status}.`;
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return body.error?.message?.trim() || fallback;
  } catch {
    return fallback;
  }
}
