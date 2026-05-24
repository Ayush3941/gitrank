"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, ExternalLink, ShieldCheck, Swords } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { usePrReport } from "@/hooks/use-pr-report";
import {
  formatContributionStatusLabel,
  toneForContributionStatus,
} from "@/lib/presentation/contribution-status";
import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";
import {
  buildDeterministicImpactSummary,
  shouldUseDeterministicImpactSummary,
} from "@/lib/presentation/deterministic-impact-summary";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import { formatEvidenceStatusLabel, toneForEvidenceStatus } from "@/lib/presentation/status-tone";

const ScoreMatrixCard = dynamic(
  () =>
    import("@/features/pr-report/components/ScoreMatrixCard").then(
      (mod) => mod.ScoreMatrixCard,
    ),
  {
    loading: () => <TechnicalPanelPlaceholder label="Loading score matrix" />,
  },
);

const XPBreakdownCard = dynamic(
  () =>
    import("@/features/pr-report/components/XPBreakdownCard").then(
      (mod) => mod.XPBreakdownCard,
    ),
  {
    loading: () => <TechnicalPanelPlaceholder label="Loading XP breakdown" />,
  },
);

const EvidenceSignalsCard = dynamic(
  () =>
    import("@/features/pr-report/components/EvidenceSignalsCard").then(
      (mod) => mod.EvidenceSignalsCard,
    ),
  {
    loading: () => <TechnicalPanelPlaceholder label="Loading evidence signals" />,
  },
);

export function PRBattleReportPageClient({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const { data, isLoading, isError, refetch } = usePrReport(owner, repo, number);
  const [showTechnicalBreakdown, setShowTechnicalBreakdown] = useState(false);

  if (isLoading) {
    return <LoadingState message="Loading report..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Battle report failed"
        description="The score breakdown could not be loaded. Retry or return to contributions."
        onRetry={() => {
          void refetch();
        }}
        fallbackLabel="Open contributions"
        fallbackHref="/dashboard/contributions"
        analyticsTarget="pr-report:error"
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        eyebrow="PR evidence"
        title="Battle report not found"
        description="This PR either has not been synced, is private, or has not produced a scored report yet."
        actionLabel="Open contributions"
        actionHref="/dashboard/contributions"
        analyticsTarget="pr-report:empty"
      />
    );
  }

  const suggestedQuest = data.suggestedQuest;
  const evidenceState = data.evidenceState;
  const sanitizedReportSummary = sanitizeReportSummary(data.contribution.aiSummary);
  const reportSummary = shouldUseDeterministicImpactSummary(sanitizedReportSummary)
    ? buildDeterministicImpactSummary(data.contribution)
    : sanitizedReportSummary;
  const evidenceAnchored = evidenceState.status === "complete" || evidenceState.status === "deterministic_only";
  const fallbackReason = extractFallbackReason(data.contribution.evidenceSignals);
  const fallbackDetail = fallbackReason ? formatFallbackReason(fallbackReason) : null;
  const summarySectionLabel = buildSummarySectionLabel({
    status: evidenceState.status,
    deterministicOnly: evidenceState.deterministicOnly,
    fallbackDetail,
  });
  const hasPersistedScoreEvidence =
    !evidenceState.missingEvidence.includes("score_event") || data.contribution.xpEarned > 0;
  const uniqueBadgeUnlocks = deduplicateBadgeUnlocks(data.badgeUnlocks);
  const suggestedQuestSignals = suggestedQuest ? buildEvidenceSignalChips(suggestedQuest.evidenceSignals, 3) : [];
  const evidenceReasonSummary = summarizeEvidenceReasons(
    evidenceState.reasons,
    evidenceAnchored,
    hasPersistedScoreEvidence,
  );
  const reportStateGuidance = buildReportStateGuidance({
    status: evidenceState.status,
    deterministicOnly: evidenceState.deterministicOnly,
    hasPersistedScoreEvidence,
    fallbackDetail,
  });
  const showEvidenceReasonSummary =
    Boolean(evidenceReasonSummary) &&
    (!evidenceAnchored ||
      evidenceReasonSummary?.toLowerCase() !== "deterministic evidence is available now.");
  const signalTier =
    data.contribution.xpEarned >= 250
      ? "High signal"
      : data.contribution.xpEarned >= 100
        ? "Medium signal"
        : "Early signal";

  return (
    <div className="stable-scroll-scope space-y-6">
      <PageHeader
        eyebrow="PR Report"
        title="PR battle report"
        description="Explainable PR score report."
        meta={(
          <HeaderMetaChips
            items={[
              { label: `${data.contribution.owner}/${data.contribution.repo}` },
              { label: `PR #${data.contribution.number}` },
              {
                label: formatContributionStatusLabel(data.contribution.status),
                tone: toneForContributionStatus(data.contribution.status),
              },
              {
                label: `Evidence ${formatEvidenceStatusLabel(evidenceState.status)}`,
                tone: toneForEvidenceStatus(evidenceState.status),
              },
            ]}
          />
        )}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/dashboard/contributions" prefetch={false}>Back to contributions</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link
                href={`https://github.com/${data.contribution.owner}/${data.contribution.repo}/pull/${data.contribution.number}`}
                prefetch={false}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      />
      <section>
        <GlowCard strong className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="break-anywhere text-sm text-muted">{data.contribution.owner}/{data.contribution.repo} #{data.contribution.number}</p>
            <h2 className="mt-2 break-anywhere text-3xl font-semibold text-white">{data.contribution.title}</h2>
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
              {data.contribution.xpEarned.toLocaleString("en-US")}
            </p>
            <div
              className={
                evidenceAnchored
                  ? "mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100"
                  : "mt-3 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100"
              }
            >
              {evidenceAnchored ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {formatEvidenceStatusLabel(evidenceState.status)}
            </div>
          </div>
        </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="neon-metric rounded-[1.4rem] px-4 py-3">
              <p className="text-xs font-medium text-muted">Category</p>
              <p className="mt-2 text-sm font-semibold text-white">{data.contribution.category}</p>
            </div>
            <div className="neon-metric rounded-[1.4rem] px-4 py-3">
              <p className="text-xs font-medium text-muted">Files changed</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {data.contribution.changedFilesCount.toLocaleString("en-US")}
              </p>
            </div>
            <div className="neon-metric rounded-[1.4rem] px-4 py-3">
              <p className="text-xs font-medium text-muted">Confidence</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {formatConfidenceLabel(evidenceState)}
              </p>
            </div>
          </div>
          <div className="neon-tile rounded-[1.5rem] p-4">
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
                  confidence {Math.round(evidenceState.analysisConfidence * 100)}%
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
      </section>
      {reportStateGuidance ? (
        <section className="render-opt-section">
          <GlowCard className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-primary">Report processing state</p>
              <span
                className={
                  reportStateGuidance.tone === "warning"
                    ? "neon-chip neon-chip-warning rounded-full px-3 py-1 text-xs font-semibold"
                    : "neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold"
                }
              >
                {reportStateGuidance.label}
              </span>
            </div>
            <p className="text-sm leading-6 text-muted">{reportStateGuidance.message}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href={reportStateGuidance.href} prefetch={false}>
                  {reportStateGuidance.cta}
                </Link>
              </Button>
            </div>
          </GlowCard>
        </section>
      ) : null}
      <section className="render-opt-section">
        <GlowCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-primary">{summarySectionLabel}</p>
            <CopyTextButton
              text={reportSummary}
              label="Copy impact summary"
              copiedLabel="Summary copied"
              analyticsTarget="pr-report/ai-summary"
              size="sm"
              variant="ghost"
            />
          </div>
          {fallbackDetail ? (
            <p className="rounded-full border border-amber-400/24 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">
              Gemini unavailable ({fallbackDetail}); showing deterministic summary.
            </p>
          ) : null}
          <ExpandableText
            text={reportSummary}
            lines={5}
            minLengthForToggle={260}
            textClassName="break-anywhere text-base leading-8 text-muted"
          />
        </GlowCard>
      </section>
      <section className="render-opt-section space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Technical breakdown</h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowTechnicalBreakdown((current) => !current);
            }}
            aria-expanded={showTechnicalBreakdown}
            aria-controls="pr-report-technical-panels"
          >
            {showTechnicalBreakdown ? "Hide details" : "Show details"}
          </Button>
        </div>
        {showTechnicalBreakdown ? (
          <div id="pr-report-technical-panels" className="space-y-6">
            <section className="render-opt-section">
              <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
                <ScoreMatrixCard report={data} />
                <XPBreakdownCard report={data} />
              </div>
            </section>
            <section className="render-opt-section">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-white">Evidence signals</h2>
                <EvidenceSignalsCard report={data} />
              </div>
            </section>
            {uniqueBadgeUnlocks.length ? (
              <section className="render-opt-section">
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-white">
                    Badge rewards ({uniqueBadgeUnlocks.length})
                  </h2>
                  <GlowCard className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                      <Award className="h-3.5 w-3.5" />
                      Rewards unlocked
                    </div>
                    <ul role="list" className="grid gap-3 md:grid-cols-2">
                      {uniqueBadgeUnlocks.map((badge, index) => {
                        const badgeSignals = buildEvidenceSignalChips(badge.evidenceSignals, 3);
                        return (
                          <li key={`${badge.key}-${index}`} className="list-none render-opt-card neon-surface rounded-[1.75rem] p-4">
                            <p className="text-lg font-semibold text-white">{badge.name}</p>
                            {badge.description ? <p className="mt-2 text-sm text-muted">{badge.description}</p> : null}
                            <p className="mt-3 text-xs text-emerald-100">
                              Rule {badge.ruleVersion ?? badge.rule ?? "persisted badge evidence"}
                            </p>
                            {badgeSignals.length ? (
                              <ul role="list" className="mt-3 flex flex-wrap gap-2">
                                {badgeSignals.map((signal, signalIndex) => (
                                  <li key={`${badge.key}-${signal}-${signalIndex}`} className="list-none">
                                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                                      {signal}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </GlowCard>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </section>
      {data.suggestedQuestId ? (
        <section className="render-opt-section">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Suggested next quest</h2>
            <GlowCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Swords className="h-3.5 w-3.5" />
                  Suggested next quest
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {suggestedQuest?.title ?? "Open the live quest board"}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  {suggestedQuest?.whyRecommended ??
                    `Suggested quest key: ${data.suggestedQuestId}. The quest board resolves this against the latest profile evidence.`}
                </p>
                {suggestedQuestSignals.length ? (
                  <ul role="list" className="mt-3 flex flex-wrap gap-2">
                    {suggestedQuestSignals.map((signal, index) => (
                      <li key={`${data.suggestedQuestId ?? "suggested-quest"}-${signal}-${index}`} className="list-none">
                        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                          {signal}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Button asChild variant="secondary">
                <Link href="/dashboard/quests" prefetch={false}>
                  Open quests
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </GlowCard>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function formatConfidenceLabel(
  evidenceState: {
    deterministicOnly: boolean;
    analysisConfidence?: number;
    status: string;
  },
): string {
  if (typeof evidenceState.analysisConfidence === "number") {
    return `${Math.round(evidenceState.analysisConfidence * 100)}%`;
  }
  if (evidenceState.deterministicOnly) {
    return "Deterministic";
  }
  if (evidenceState.status === "rate_limited") {
    return "Rate limited";
  }
  return "Pending";
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
  return "Impact summary (Gemini)";
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
  if (normalized === "hybrid" || (normalized.includes("gemini") && normalized.includes("deterministic"))) {
    return "gemini + deterministic";
  }
  if (normalized.includes("gemini") || normalized.includes("ai_assisted")) {
    return "gemini";
  }
  if (normalized.includes("deterministic")) {
    return fallbackDetail
      ? `deterministic fallback (${fallbackDetail})`
      : "deterministic";
  }
  return normalized;
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
  return normalized.slice(0, 2).join(" · ");
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
      : "Gemini analysis is still processing.";
  }
  if (normalized.includes("analysis is deterministic-only; no ai enrichment is attached")) {
    return "Deterministic report is available now.";
  }
  if (normalized.includes("analysis has not been persisted")) {
    return evidenceReady
      ? "Deterministic evidence is available now."
      : "Gemini analysis is still processing.";
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
        "Gemini enrichment is temporarily rate limited. The deterministic score remains valid and this report will enrich after retry.",
      cta: "Open settings",
      href: "/dashboard/settings",
    };
  }

  if (status === "ai_fallback") {
    return {
      tone: "warning",
      label: "Deterministic fallback",
      message: fallbackDetail
        ? `Gemini response was unavailable (${fallbackDetail}). Deterministic evidence is still serving this report.`
        : "Gemini response was unavailable. Deterministic evidence is still serving this report.",
      cta: "Open settings",
      href: "/dashboard/settings",
    };
  }

  if (status === "stale" || status === "incomplete") {
    return {
      tone: "warning",
      label: "Refresh pending",
      message:
        "This report snapshot is waiting for the latest sync or scoring replay. Trigger a refresh to pull the newest PR evidence.",
      cta: "Open settings",
      href: "/dashboard/settings",
    };
  }

  if (status === "deterministic_only" || deterministicOnly || hasPersistedScoreEvidence) {
    return {
      tone: "info",
      label: "Deterministic mode",
      message:
        "This report is currently deterministic-only. Scoring evidence is valid, and Gemini enrichment may appear after background processing completes.",
      cta: "View contributions",
      href: "/dashboard/contributions",
    };
  }

  return {
    tone: "warning",
    label: "Processing",
    message:
      "Report evidence is still processing. Reopen this report after sync and scoring jobs complete.",
    cta: "Open settings",
    href: "/dashboard/settings",
  };
}

function deduplicateBadgeUnlocks(
  badges: {
    key: string;
    name: string;
    description?: string;
    rule?: string;
    ruleVersion?: string;
    evidenceSignals: string[];
  }[],
) {
  const byName = new Map<
    string,
    {
      key: string;
      name: string;
      description?: string;
      rule?: string;
      ruleVersion?: string;
      evidenceSignals: string[];
    }
  >();

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

function TechnicalPanelPlaceholder({ label }: { label: string }) {
  return (
    <GlowCard variant="loading" className="min-h-[14rem] space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-10 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
