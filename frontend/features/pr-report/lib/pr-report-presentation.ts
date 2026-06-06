import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
import {
  buildDeterministicImpactSummary,
  shouldUseDeterministicImpactSummary,
} from "@/lib/presentation/deterministic-impact-summary";
import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { PullRequestAnalysis } from "@/types/gitrank";

export type PRReportBadgeReward = {
  key: string;
  name: string;
  description?: string;
  rule?: string;
  ruleVersion?: string;
  evidenceSignals: string[];
};

export function buildPRReportPresentation(report: PullRequestAnalysis) {
  const evidenceState = report.evidenceState;
  const sanitizedReportSummary = sanitizeReportSummary(report.contribution.aiSummary);
  const reportSummary = shouldUseDeterministicImpactSummary(sanitizedReportSummary)
    ? buildDeterministicImpactSummary(report.contribution)
    : sanitizedReportSummary;
  const evidenceAnchored =
    evidenceState.status === "complete" ||
    evidenceState.status === "deterministic_only";
  const fallbackReason = extractFallbackReason(report.contribution.evidenceSignals);
  const fallbackDetail = fallbackReason ? formatFallbackReason(fallbackReason) : null;
  const hasPersistedScoreEvidence =
    !evidenceState.missingEvidence.includes("score_event") ||
    report.contribution.xpEarned > 0;
  const evidenceReasonSummary = summarizeEvidenceReasons(
    evidenceState.reasons,
    evidenceAnchored,
    hasPersistedScoreEvidence,
  );

  return {
    reportSummary,
    evidenceAnchored,
    fallbackDetail,
    summarySectionLabel: buildSummarySectionLabel({
      status: evidenceState.status,
      deterministicOnly: evidenceState.deterministicOnly,
      fallbackDetail,
    }),
    hasPersistedScoreEvidence,
    uniqueBadgeUnlocks: deduplicateBadgeUnlocks(report.badgeUnlocks),
    suggestedQuestSignals: report.suggestedQuest
      ? buildEvidenceSignalChips(report.suggestedQuest.evidenceSignals, 3)
      : [],
    evidenceReasonSummary,
    reportStateGuidance: buildReportStateGuidance({
      status: evidenceState.status,
      deterministicOnly: evidenceState.deterministicOnly,
      hasPersistedScoreEvidence,
      fallbackDetail,
    }),
    canRetryAiSummary: shouldShowAiSummaryRetry({
      status: evidenceState.status,
      deterministicOnly: evidenceState.deterministicOnly,
      aiFallback: evidenceState.aiFallback,
      rateLimited: evidenceState.rateLimited,
    }),
    showEvidenceReasonSummary:
      Boolean(evidenceReasonSummary) &&
      (!evidenceAnchored ||
        evidenceReasonSummary?.toLowerCase() !==
          "deterministic evidence is available now."),
    signalTier: buildSignalTier(report.contribution.xpEarned),
  };
}

export function buildRetryAiSummaryNotice(result: ApiSyncExecutionResponse): {
  tone: "success" | "warning";
  message: string;
} {
  const status = result.status.trim().toLowerCase();
  if (status === "partial") {
    return {
      tone: "warning",
      message:
        "Retry executed with partial upstream data. Deterministic score stays active while AI enrichment retries.",
    };
  }
  if (status === "queued") {
    return {
      tone: "success",
      message:
        "Retry queued. Keep this report open for a moment while enrichment catches up.",
    };
  }
  return {
    tone: "success",
    message:
      "Retry executed. This report will refresh with AI text after scoring and persistence settle.",
  };
}

function buildSummarySectionLabel({
  status,
  deterministicOnly,
  fallbackDetail,
}: {
  status: string;
  deterministicOnly: boolean;
  fallbackDetail: string | null;
}): string {
  if (fallbackDetail) {
    return "Impact summary (deterministic fallback)";
  }
  if (deterministicOnly || status === "deterministic_only") {
    return "Impact summary (deterministic)";
  }
  return "Impact summary (ChatGPT)";
}

function extractFallbackReason(signals: string[]): string | null {
  for (const signal of signals) {
    if (!signal.startsWith("fallback_reason=")) {
      continue;
    }
    const value = signal.slice("fallback_reason=".length).trim();
    return value.length > 0 ? value : null;
  }
  return null;
}

function formatFallbackReason(reason: string): string {
  const normalized = reason.trim().toLowerCase();
  const map: Record<string, string> = {
    ai_rate_limited: "rate limited",
    ai_quota_exceeded: "quota exceeded",
    ai_auth_failed: "auth failed",
    ai_invalid_request: "invalid request",
    ai_provider_error: "provider error",
    ai_transport_error: "network issue",
    ai_empty_response: "empty response",
    ai_empty_summary: "empty summary",
    ai_invalid_response: "invalid response",
    ai_guardrail_rejected: "guardrail rejected",
    ai_validation_failed: "validation failed",
    ai_request_failed: "request failed",
  };
  return map[normalized] ?? normalized.replaceAll("_", " ");
}

function summarizeEvidenceReasons(
  reasons: string[],
  evidenceAnchored: boolean,
  hasPersistedScoreEvidence: boolean,
): string | null {
  if (!reasons.length) {
    return null;
  }
  const normalized = reasons
    .map((reason) =>
      normalizeEvidenceReason(reason, evidenceAnchored, hasPersistedScoreEvidence),
    )
    .filter((reason): reason is string => Boolean(reason));
  if (!normalized.length) {
    return null;
  }
  return normalized.slice(0, 2).join(" \u00b7 ");
}

function normalizeEvidenceReason(
  reason: string,
  evidenceAnchored: boolean,
  hasPersistedScoreEvidence: boolean,
): string | null {
  const normalized = reason.trim().toLowerCase();
  const evidenceReady = evidenceAnchored || hasPersistedScoreEvidence;
  if (!normalized) {
    return null;
  }
  if (normalized.includes("analysis: unknown") || normalized.includes("missing analysis")) {
    return evidenceReady
      ? "Deterministic evidence is available now."
      : "AI analysis is still processing.";
  }
  if (normalized.includes("analysis is deterministic-only; no ai enrichment is attached")) {
    return "Deterministic report is available now.";
  }
  if (normalized.includes("analysis has not been persisted")) {
    return evidenceReady
      ? "Deterministic evidence is available now."
      : "AI analysis is still processing.";
  }
  if (normalized.includes("report is stale until analysis and scoring both complete")) {
    return evidenceReady ? null : "Report refresh is pending the next scoring replay.";
  }
  if (normalized.includes("report snapshot is stale")) {
    return evidenceReady ? null : "Report refresh is pending the next scoring replay.";
  }
  if (normalized.includes("fallback reason")) {
    return null;
  }
  return reason;
}

function shouldShowAiSummaryRetry({
  status,
  deterministicOnly,
  aiFallback,
  rateLimited,
}: {
  status: string;
  deterministicOnly: boolean;
  aiFallback: boolean;
  rateLimited: boolean;
}): boolean {
  if (rateLimited || aiFallback || deterministicOnly) {
    return true;
  }
  const normalizedStatus = status.trim().toLowerCase();
  return (
    normalizedStatus === "rate_limited" ||
    normalizedStatus === "ai_fallback" ||
    normalizedStatus === "deterministic_only"
  );
}

function buildReportStateGuidance({
  status,
  deterministicOnly,
  hasPersistedScoreEvidence,
  fallbackDetail,
}: {
  status: string;
  deterministicOnly: boolean;
  hasPersistedScoreEvidence: boolean;
  fallbackDetail?: string | null;
}):
  | {
      tone: "warning" | "info";
      label: string;
      message: string;
      cta: string;
      href: string;
    }
  | null {
  if (status === "complete") {
    return null;
  }

  if (status === "rate_limited") {
    return {
      tone: "warning",
      label: "Rate limited",
      message:
        "ChatGPT hit provider limits. Deterministic scoring is still valid; retry later for enriched text.",
      cta: "Open settings",
      href: "/dashboard/settings",
    };
  }

  if (status === "ai_fallback") {
    return {
      tone: "warning",
      label: "Deterministic fallback",
      message: fallbackDetail
        ? `ChatGPT response failed (${fallbackDetail}). Deterministic evidence is serving this report.`
        : "ChatGPT response failed. Deterministic evidence is serving this report.",
      cta: "Open settings",
      href: "/dashboard/settings",
    };
  }

  if (status === "stale" || status === "incomplete") {
    return {
      tone: "warning",
      label: "Refresh pending",
      message:
        "This report is behind the latest sync. Reopen it after sync settles.",
      cta: "Open settings",
      href: "/dashboard/settings",
    };
  }

  if (status === "deterministic_only" || deterministicOnly || hasPersistedScoreEvidence) {
    return {
      tone: "info",
      label: "Deterministic mode",
      message:
        "Only deterministic analysis is available right now. ChatGPT enrichment may appear after retries.",
      cta: "View contributions",
      href: "/dashboard/contributions",
    };
  }

  return {
    tone: "warning",
    label: "Processing",
    message:
      "Report data is still processing. Reopen after sync and scoring complete.",
    cta: "Open settings",
    href: "/dashboard/settings",
  };
}

function deduplicateBadgeUnlocks(badges: PRReportBadgeReward[]) {
  const byName = new Map<string, PRReportBadgeReward>();

  for (const badge of badges) {
    const normalizedName = badge.name.trim().toLowerCase();
    const existing = byName.get(normalizedName);
    if (!existing) {
      byName.set(normalizedName, {
        ...badge,
        evidenceSignals: uniqueStrings(badge.evidenceSignals),
      });
      continue;
    }
    byName.set(normalizedName, {
      ...existing,
      key: existing.key || badge.key,
      name: existing.name || badge.name,
      description: existing.description || badge.description,
      rule: existing.rule || badge.rule,
      ruleVersion: existing.ruleVersion || badge.ruleVersion,
      evidenceSignals: uniqueStrings([...existing.evidenceSignals, ...badge.evidenceSignals]),
    });
  }

  return Array.from(byName.values());
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(value);
  }
  return output;
}

function buildSignalTier(xpEarned: number): "High signal" | "Medium signal" | "Early signal" {
  if (xpEarned >= 250) {
    return "High signal";
  }
  if (xpEarned >= 100) {
    return "Medium signal";
  }
  return "Early signal";
}
