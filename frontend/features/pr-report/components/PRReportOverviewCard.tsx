"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { formatNumber, formatRatioPercent, formatXp } from "@/lib/formatters";
import { formatEvidenceStatusLabel } from "@/lib/presentation/status-tone";
import type { PREvidenceState, PullRequestAnalysis } from "@/types/gitrank";

export function PRReportOverviewCard({
  report,
  signalTier,
  evidenceAnchored,
  hasPersistedScoreEvidence,
  fallbackDetail,
  evidenceReasonSummary,
  showEvidenceReasonSummary,
}: {
  report: PullRequestAnalysis;
  signalTier: string;
  evidenceAnchored: boolean;
  hasPersistedScoreEvidence: boolean;
  fallbackDetail: string | null;
  evidenceReasonSummary: string | null;
  showEvidenceReasonSummary: boolean;
}) {
  const { contribution, evidenceState } = report;

  return (
    <GlowCard strong className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-anywhere text-sm text-muted">
            {contribution.owner}/{contribution.repo} #{contribution.number}
          </p>
          <h2 className="mt-2 break-anywhere text-3xl font-semibold text-white">
            {contribution.title}
          </h2>
          <ul role="list" className="mt-3 flex flex-wrap gap-2 text-xs">
            <li className="list-none">
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                Signal {signalTier}
              </span>
            </li>
          </ul>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-primary">XP earned</p>
          <p className="numeric-readout mt-2 text-4xl font-semibold text-white">
            {formatXp(contribution.xpEarned)}
          </p>
          <div
            className={
              evidenceAnchored
                ? "mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100"
                : "mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100"
            }
          >
            {evidenceAnchored ? (
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {formatEvidenceStatusLabel(evidenceState.status)}
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
          <p className="text-xs font-medium text-muted">Category</p>
          <p className="mt-2 text-sm font-semibold text-white">{contribution.category}</p>
        </div>
        <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
          <p className="text-xs font-medium text-muted">Files changed</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {formatNumber(contribution.changedFilesCount)}
          </p>
        </div>
        <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
          <p className="text-xs font-medium text-muted">Confidence</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {formatConfidenceLabel(evidenceState)}
          </p>
        </div>
      </div>
      <div className="neon-tile rounded-[var(--radius-universal)] p-4">
        <p className="text-xs font-medium text-muted">Evidence state</p>
        <ul role="list" className="mt-3 flex flex-wrap gap-2">
          <li className="list-none">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
              {formatAnalysisSource(
                evidenceState.analysisSource,
                evidenceState.deterministicOnly,
                hasPersistedScoreEvidence,
                fallbackDetail,
              )}
            </span>
          </li>
          {typeof evidenceState.analysisConfidence === "number" ? (
            <li className="list-none">
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                confidence {formatRatioPercent(evidenceState.analysisConfidence)}
              </span>
            </li>
          ) : null}
          {fallbackDetail ? (
            <li className="list-none">
              <span className="rounded-full border border-amber-400/22 bg-amber-400/12 px-3 py-1 text-xs text-amber-100">
                fallback {fallbackDetail}
              </span>
            </li>
          ) : null}
        </ul>
        {showEvidenceReasonSummary && evidenceReasonSummary ? (
          <ExpandableText
            text={evidenceReasonSummary}
            lines={2}
            minLengthForToggle={160}
            className="mt-3"
            textClassName="break-anywhere text-sm text-muted"
          />
        ) : null}
      </div>
    </GlowCard>
  );
}

function formatConfidenceLabel(
  evidenceState: Pick<PREvidenceState, "deterministicOnly" | "analysisConfidence" | "status">,
): string {
  if (typeof evidenceState.analysisConfidence === "number") {
    return formatRatioPercent(evidenceState.analysisConfidence);
  }
  if (evidenceState.deterministicOnly) {
    return "Deterministic";
  }
  if (evidenceState.status === "rate_limited") {
    return "Rate limited";
  }
  return "Pending";
}

function formatAnalysisSource(
  source?: string,
  deterministicOnly = false,
  hasPersistedScoreEvidence = false,
  fallbackDetail?: string | null,
): string {
  const normalized = (source ?? "").trim().toLowerCase();
  if (normalized.length === 0 || normalized === "unknown") {
    if (fallbackDetail) {
      return `deterministic fallback (${fallbackDetail})`;
    }
    if (deterministicOnly || hasPersistedScoreEvidence) {
      return "deterministic";
    }
    return "processing";
  }
  if (
    normalized === "hybrid" ||
    ((normalized.includes("gemini") || normalized.includes("openai")) &&
      normalized.includes("deterministic"))
  ) {
    return "chatgpt + deterministic";
  }
  if (
    normalized.includes("openai") ||
    normalized.includes("gemini") ||
    normalized.includes("ai_assisted")
  ) {
    return "chatgpt";
  }
  if (normalized.includes("deterministic")) {
    return fallbackDetail
      ? `deterministic fallback (${fallbackDetail})`
      : "deterministic";
  }
  return normalized;
}
