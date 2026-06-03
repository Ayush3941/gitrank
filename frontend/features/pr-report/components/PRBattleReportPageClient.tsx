"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, ExternalLink, ShieldCheck, Swords } from "lucide-react";
import { useId, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { GlowCard } from "@/components/shared/GlowCard";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { NewTabHint } from "@/components/shared/NewTabHint";
import { InlineNotice } from "@/components/shared/InlineNotice";
import { PageHeader } from "@/components/shared/PageHeader";
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
  const [showLedgerNotes, setShowLedgerNotes] = useState(false);
  const technicalPanelsId = useId();
  const technicalToggleId = useId();
  const ledgerRegionId = useId();
  const ledgerToggleId = useId();
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
        repository: `${data.contribution.owner}/${data.contribution.repo}`,
        number: data.contribution.number,
      });
      setRetryNotice(buildRetryAiSummaryNotice(result));
      await refetch();
    } catch (error) {
      const message = sanitizeUserFacingError(
        (error as Error | null)?.message || "",
        "pr-report:retry-ai-summary",
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
              {evidenceAnchored ? <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> : <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
              {formatEvidenceStatusLabel(evidenceState.status)}
            </div>
          </div>
        </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
              <p className="text-xs font-medium text-muted">Category</p>
              <p className="mt-2 text-sm font-semibold text-white">{data.contribution.category}</p>
            </div>
            <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
              <p className="text-xs font-medium text-muted">Files changed</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {data.contribution.changedFilesCount.toLocaleString("en-US")}
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
      <section
        id="pr-report-ledger"
        data-scroll-target="true"
        className="render-opt-section"
      >
        <GlowCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-primary">Deterministic metrics ledger</p>
              <h2 className="mt-2 text-sm font-semibold text-white">Deterministic scoring inputs and outputs</h2>
              <p className="mt-2 text-xs text-muted">
                Only metrics used directly by the deterministic score formula are shown here.
              </p>
            </div>
            <DisclosureToggle
              id={ledgerToggleId}
              controlsId={ledgerRegionId}
              expanded={showLedgerNotes}
              onToggle={() => {
                setShowLedgerNotes((current) => !current);
              }}
              collapsedLabel="Show metric notes"
              expandedLabel="Hide metric notes"
            />
          </div>
          <div id={ledgerRegionId} role="region" aria-labelledby={ledgerToggleId} className="space-y-4">
            <LedgerSection
              title="Score outputs"
              description="Final output from deterministic scoring."
              showDescriptions={showLedgerNotes}
              metrics={[
                {
                  id: "xp_earned",
                  label: "XP earned",
                  value: data.contribution.xpEarned.toLocaleString("en-US"),
                  description: "Final deterministic XP after multipliers and penalties.",
                },
                {
                  id: "score_version",
                  label: "Score version",
                  value: data.scoreVersion || "unknown",
                  description: "Scoring formula revision used for this result.",
                },
              ]}
            />
            <LedgerSection
              title="Core scoring signals"
              description="Primary inputs used directly by scoring."
              showDescriptions={showLedgerNotes}
              metrics={[
                {
                  id: "status",
                  label: "Status",
                  value: formatContributionStatusLabel(data.contribution.status),
                  description: "PR state used by the outcome weight.",
                },
                {
                  id: "category",
                  label: "Category",
                  value: data.contribution.category,
                  description: "Detected contribution type.",
                },
                {
                  id: "difficulty_score",
                  label: "Difficulty score",
                  value: String(data.contribution.difficultyScore),
                  description: "Complexity signal from size and code surface.",
                },
                {
                  id: "impact_score",
                  label: "Impact score",
                  value: String(data.contribution.impactScore),
                  description: "Projected contribution effect.",
                },
                {
                  id: "review_depth",
                  label: "Review depth",
                  value: String(data.contribution.reviewDepthScore),
                  description: "Reviewer activity signal.",
                },
                {
                  id: "test_signal",
                  label: "Test signal",
                  value: String(data.contribution.testSignalScore),
                  description: "Regression test evidence signal.",
                },
                {
                  id: "repo_weight",
                  label: "Repo weight",
                  value: data.contribution.repoWeight.toFixed(2),
                  description: "Repository multiplier in XP math.",
                },
                {
                  id: "anti_spam_multiplier",
                  label: "Anti-spam multiplier",
                  value: `${data.contribution.antiSpamMultiplier.toFixed(2)}x`,
                  description: "Caps repeated low-signal contribution patterns.",
                },
              ]}
            />
            <LedgerSection
              title="Change-volume inputs"
              description="Raw change-size inputs used by deterministic analysis."
              showDescriptions={showLedgerNotes}
              metrics={[
                {
                  id: "changed_files",
                  label: "Changed files",
                  value: data.contribution.changedFilesCount.toLocaleString("en-US"),
                  description: "File count input.",
                },
                {
                  id: "additions",
                  label: "Additions",
                  value: data.contribution.additions.toLocaleString("en-US"),
                  description: "Added line-count input.",
                },
                {
                  id: "deletions",
                  label: "Deletions",
                  value: data.contribution.deletions.toLocaleString("en-US"),
                  description: "Deleted line-count input.",
                },
              ]}
            />
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
              {canRetryAiSummary ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={runPullRequestSync.isPending}
                  onClick={() => {
                    void handleRetryAiSummary();
                  }}
                >
                  {runPullRequestSync.isPending ? "Retrying..." : "Retry AI summary"}
                </Button>
              ) : null}
              <Button asChild size="sm" variant="secondary">
                <Link href={reportStateGuidance.href} prefetch={false}>
                  {reportStateGuidance.cta}
                </Link>
              </Button>
            </div>
            <InlineNotice
              message={retryNotice?.message}
              variant={retryNotice?.tone ?? "info"}
              placeholder="AI retry status"
              minHeightClassName="min-h-7"
              onDismiss={
                retryNotice
                  ? () => {
                      setRetryNotice(null);
                    }
                  : undefined
              }
              dismissLabel="Dismiss retry status"
            />
          </GlowCard>
        </section>
      ) : null}
      <section
        id="pr-report-summary"
        data-scroll-target="true"
        className="render-opt-section"
      >
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
              ChatGPT unavailable ({fallbackDetail}). Showing deterministic summary.
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
            {uniqueBadgeUnlocks.length ? (
              <section className="render-opt-section">
                <div className="space-y-4">
                  <h2 className="text-sm font-semibold text-white">
                    Badge rewards ({uniqueBadgeUnlocks.length})
                  </h2>
                  <GlowCard className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
                      <Award className="h-3.5 w-3.5" aria-hidden="true" />
                      Rewards unlocked
                    </div>
                    <ul role="list" className="grid gap-3 md:grid-cols-2">
                      {uniqueBadgeUnlocks.map((badge, index) => {
                        const badgeSignals = buildEvidenceSignalChips(badge.evidenceSignals, 3);
                        return (
                          <li key={`${badge.key}-${index}`} className="list-none render-opt-card neon-surface rounded-[var(--radius-universal)] p-4">
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
        <section className="render-opt-section">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Suggested next quest</h2>
            <GlowCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Swords className="h-3.5 w-3.5" aria-hidden="true" />
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
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
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
  if (normalized === "hybrid" || ((normalized.includes("gemini") || normalized.includes("openai")) && normalized.includes("deterministic"))) {
    return "chatgpt + deterministic";
  }
  if (normalized.includes("openai") || normalized.includes("gemini") || normalized.includes("ai_assisted")) {
    return "chatgpt";
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
    <GlowCard variant="loading" className="min-h-[14rem] space-y-3">
      <p className="text-xs font-medium text-primary">{label}</p>
      <div className="neon-skeleton h-10 w-1/2" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}

type LedgerMetric = {
  id: string;
  label: string;
  value: string;
  description: string;
};

function LedgerSection({
  title,
  description,
  showDescriptions,
  metrics,
}: {
  title: string;
  description: string;
  showDescriptions: boolean;
  metrics: LedgerMetric[];
}) {
  return (
    <section className="space-y-3 rounded-[var(--radius-universal)] border border-white/10 bg-black/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{title}</h3>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted">
          {metrics.length} metrics
        </span>
      </div>
      <p className="text-xs text-muted">{description}</p>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCell
            key={metric.id}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            showDescription={showDescriptions}
          />
        ))}
      </dl>
    </section>
  );
}

function MetricCell({
  label,
  value,
  description,
  showDescription,
}: {
  label: string;
  value: string;
  description: string;
  showDescription: boolean;
}) {
  return (
    <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="break-anywhere mt-1 text-sm font-semibold text-white" title={description}>
        {value}
      </dd>
      {showDescription ? <dd className="break-anywhere mt-2 text-xs leading-5 text-muted">{description}</dd> : null}
    </div>
  );
}
