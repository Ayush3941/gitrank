"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useId, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { NewTabHint } from "@/components/shared/NewTabHint";
import { PageHeader } from "@/components/shared/PageHeader";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { Button } from "@/components/ui/button";
import { useRunPullRequestSync } from "@/hooks/use-account-actions";
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
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
import { DeterministicMetricsLedgerCard } from "@/features/pr-report/components/DeterministicMetricsLedgerCard";
import { PRReportImpactSummaryCard } from "@/features/pr-report/components/PRReportImpactSummaryCard";
import { PRReportBadgeRewardsCard } from "@/features/pr-report/components/PRReportBadgeRewardsCard";
import { PRReportOverviewCard } from "@/features/pr-report/components/PRReportOverviewCard";
import { PRReportSuggestedQuestCard } from "@/features/pr-report/components/PRReportSuggestedQuestCard";
import { ReportProcessingStateCard } from "@/features/pr-report/components/ReportProcessingStateCard";

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

const PR_REPORT_SECTION_LINKS = [
  { id: "pr-report-overview", label: "Overview" },
  { id: "pr-report-ledger", label: "Ledger" },
  { id: "pr-report-summary", label: "Summary" },
  { id: "pr-report-technical", label: "Technical" },
];

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
  const runPullRequestSync = useRunPullRequestSync();
  const [showTechnicalBreakdown, setShowTechnicalBreakdown] = useState(false);
  const technicalPanelsId = useId();
  const technicalToggleId = useId();
  const [retryNotice, setRetryNotice] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  if (isLoading) {
    return (
      <RouteLoadingState
        eyebrow="PR report"
        title="PR battle report"
        description="Loading deterministic score evidence and contribution signals."
        cardCount={4}
        variant="report"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Battle report failed"
        description="The score breakdown is unavailable right now. Retry or return to contributions."
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
        title="Battle report unavailable"
        description="This PR may still be syncing, may be private, or may be waiting for score report generation."
        actionLabel="Open contributions"
        actionHref="/dashboard/contributions"
        analyticsTarget="pr-report:empty"
      />
    );
  }

  const reportData = data;
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
  const canRetryAiSummary = shouldShowAiSummaryRetry({
    status: evidenceState.status,
    deterministicOnly: evidenceState.deterministicOnly,
    aiFallback: evidenceState.aiFallback,
    rateLimited: evidenceState.rateLimited,
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

  async function handleRetryAiSummary() {
    setRetryNotice(null);
    try {
      const result = await runPullRequestSync.mutateAsync({
        repository: `${reportData.contribution.owner}/${reportData.contribution.repo}`,
        number: reportData.contribution.number,
      });
      setRetryNotice(buildRetryAiSummaryNotice(result));
      await refetch();
    } catch (error) {
      const message = sanitizeUserFacingError(
        (error as Error | null)?.message || "",
        "pr-report-retry-ai-summary",
      );
      setRetryNotice({
        tone: "error",
        message: message || "Retry failed. Try again from Settings after a short delay.",
      });
    }
  }

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
            <SnapshotFreshnessPill
              refreshedAt={data.generatedAt ?? data.sourceUpdatedAt}
              label="Generated"
            />
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
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <NewTabHint />
              </Link>
            </Button>
          </div>
        )}
      />
      <InPageSectionNav sections={PR_REPORT_SECTION_LINKS} className="render-opt-section" />
      <section id="pr-report-overview" data-scroll-target="true" className="render-opt-section">
        <PRReportOverviewCard
          report={data}
          signalTier={signalTier}
          evidenceAnchored={evidenceAnchored}
          hasPersistedScoreEvidence={hasPersistedScoreEvidence}
          fallbackDetail={fallbackDetail}
          evidenceReasonSummary={evidenceReasonSummary}
          showEvidenceReasonSummary={showEvidenceReasonSummary}
        />
      </section>
      <section
        id="pr-report-ledger"
        data-scroll-target="true"
        className="render-opt-section"
      >
        <DeterministicMetricsLedgerCard report={data} />
      </section>
      {reportStateGuidance ? (
        <ReportProcessingStateCard
          guidance={reportStateGuidance}
          canRetryAiSummary={canRetryAiSummary}
          isRetrying={runPullRequestSync.isPending}
          retryNotice={retryNotice}
          onRetryAiSummary={handleRetryAiSummary}
          onDismissRetryNotice={() => {
            setRetryNotice(null);
          }}
        />
      ) : null}
      <section
        id="pr-report-summary"
        data-scroll-target="true"
        className="render-opt-section"
      >
        <PRReportImpactSummaryCard
          label={summarySectionLabel}
          summary={reportSummary}
          fallbackDetail={fallbackDetail}
        />
      </section>
      <section
        id="pr-report-technical"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">Technical breakdown</h2>
          <DisclosureToggle
            id={technicalToggleId}
            controlsId={technicalPanelsId}
            expanded={showTechnicalBreakdown}
            onToggle={() => {
              setShowTechnicalBreakdown((current) => !current);
            }}
            collapsedLabel="Show details"
            expandedLabel="Hide details"
          />
        </div>
        <div
          id={technicalPanelsId}
          role="region"
          aria-labelledby={technicalToggleId}
        >
          {showTechnicalBreakdown ? (
          <div className="space-y-6">
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
            <PRReportBadgeRewardsCard badges={uniqueBadgeUnlocks} />
          </div>
          ) : (
          <GlowCard className="space-y-4">
            <p className="text-xs font-medium text-primary">Quick read</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
                <p className="text-xs text-muted">Difficulty</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {data.contribution.difficultyScore}
                </p>
              </div>
              <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
                <p className="text-xs text-muted">Impact</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {data.contribution.impactScore}
                </p>
              </div>
              <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
                <p className="text-xs text-muted">Review depth</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {data.contribution.reviewDepthScore}
                </p>
              </div>
              <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
                <p className="text-xs text-muted">Test signal</p>
                <p className="mt-1 text-sm font-semibold text-white">
                  {data.contribution.testSignalScore}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted">
              Open details for full math, evidence signals, and badge rewards.
            </p>
          </GlowCard>
          )}
        </div>
      </section>
      {data.suggestedQuestId ? (
        <PRReportSuggestedQuestCard
          questId={data.suggestedQuestId}
          title={suggestedQuest?.title}
          whyRecommended={suggestedQuest?.whyRecommended}
          signals={suggestedQuestSignals}
        />
      ) : null}
    </div>
  );
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

function buildRetryAiSummaryNotice(result: ApiSyncExecutionResponse): {
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
    <PanelLoadingPlaceholder
      label={label}
      minHeightClassName="min-h-[14rem]"
      cardVariant="loading"
      skeletons={[
        { className: "h-10 w-1/2" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
