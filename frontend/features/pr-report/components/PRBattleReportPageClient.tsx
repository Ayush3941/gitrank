"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, ShieldCheck, Swords } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { EvidenceSignalsCard } from "@/features/pr-report/components/EvidenceSignalsCard";
import { ScoreMatrixCard } from "@/features/pr-report/components/ScoreMatrixCard";
import { XPBreakdownCard } from "@/features/pr-report/components/XPBreakdownCard";
import { usePrReport } from "@/hooks/use-pr-report";

export function PRBattleReportPageClient({
  owner,
  repo,
  number,
}: {
  owner: string;
  repo: string;
  number: number;
}) {
  const { data, isLoading, isError } = usePrReport(owner, repo, number);
  const [showTechnicalBreakdown, setShowTechnicalBreakdown] = useState(false);

  if (isLoading) {
    return <LoadingState message="Calculating PR intensity..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Battle report failed"
        description="The score breakdown could not be computed. Retry or return to the contribution drill-down."
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
  const evidenceAnchored = evidenceState.status === "complete" || evidenceState.status === "deterministic_only";
  const fallbackReason = extractFallbackReason(data.contribution.evidenceSignals);
  const fallbackDetail = fallbackReason ? formatFallbackReason(fallbackReason) : null;
  const deterministicOnlyWithoutFallback = evidenceState.deterministicOnly && !fallbackDetail;
  const hasPersistedScoreEvidence =
    !evidenceState.missingEvidence.includes("score_event") || data.contribution.xpEarned > 0;
  const uniqueBadgeUnlocks = deduplicateBadgeUnlocks(data.badgeUnlocks);
  const evidenceReasonSummary = summarizeEvidenceReasons(
    evidenceState.reasons,
    evidenceAnchored || hasPersistedScoreEvidence,
  );
  const signalTier =
    data.contribution.xpEarned >= 250
      ? "High signal"
      : data.contribution.xpEarned >= 100
        ? "Medium signal"
        : "Early signal";
  const signalDetail = `${data.contribution.category} • ${data.contribution.changedFilesCount} files changed`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PR Report"
        title="PR battle report"
        description="Explainable score with evidence context."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/dashboard/contributions">Back to contributions</Link>
            </Button>
          </div>
        )}
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
          Signal {signalTier}
        </span>
        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
          {signalDetail}
        </span>
        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
          {evidenceAnchored ? "Anchored evidence" : "Partial evidence"}
        </span>
      </div>
      <section id="pr-report-overview" className="scroll-mt-24">
        <GlowCard strong className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="break-anywhere text-sm text-muted">{data.contribution.owner}/{data.contribution.repo} #{data.contribution.number}</p>
            <h2 className="mt-2 break-anywhere text-3xl font-semibold text-white">{data.contribution.title}</h2>
            <p className="mt-3 text-sm text-muted">
              {data.contribution.status} • {data.contribution.category}
            </p>
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
              {evidenceState.status.replace("_", " ")}
            </div>
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
            {evidenceState.missingEvidence.length ? (
              <li className="list-none">
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                  partial evidence
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
          {evidenceReasonSummary ? (
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
      <section className="render-opt-section space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">Technical breakdown</p>
            <p className="text-xs text-muted">Score matrix, evidence signals, and reward derivation details.</p>
          </div>
          <Button
            type="button"
            variant={showTechnicalBreakdown ? "secondary" : "default"}
            size="sm"
            aria-expanded={showTechnicalBreakdown}
            aria-controls="pr-report-technical-panels"
            onClick={() => {
              setShowTechnicalBreakdown((current) => !current);
            }}
          >
            {showTechnicalBreakdown ? "Hide technical breakdown" : "Show technical breakdown"}
          </Button>
        </div>
        {!showTechnicalBreakdown ? (
          <div
            id="pr-report-technical-panels"
            className="neon-surface rounded-[1.35rem] border-dashed border-primary/24 px-4 py-4 text-sm text-muted"
          >
            Deep scoring and evidence panels are hidden by default for faster scanning.
          </div>
        ) : null}
      </section>
      <section id="pr-report-ai" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading AI summary" />}>
          <GlowCard className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-primary">AI summary</p>
              <CopyTextButton
                text={data.contribution.aiSummary}
                label="Copy summary"
                copiedLabel="Summary copied"
                analyticsTarget="pr-report/ai-summary"
                size="sm"
                variant="ghost"
              />
            </div>
            {fallbackDetail ? (
              <p className="rounded-full border border-amber-400/24 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100">
                Gemini enrichment unavailable: {fallbackDetail}. Showing deterministic summary.
              </p>
            ) : null}
            {deterministicOnlyWithoutFallback ? (
              <p className="rounded-full border border-cyan-300/24 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-100">
                Deterministic analysis only in this snapshot.
              </p>
            ) : null}
            <ExpandableText
              text={data.contribution.aiSummary}
              lines={5}
              minLengthForToggle={260}
              textClassName="break-anywhere text-base leading-8 text-muted"
            />
          </GlowCard>
        </DeferUntilVisible>
      </section>
      {showTechnicalBreakdown ? (
        <div id="pr-report-technical-panels" className="space-y-6">
          <section id="pr-report-score" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading score matrix" />}>
              <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
                <ScoreMatrixCard report={data} />
                <XPBreakdownCard report={data} />
              </div>
            </DeferUntilVisible>
          </section>
          <section id="pr-report-evidence" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading evidence signals" />}>
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-white">Evidence signals</h2>
                <EvidenceSignalsCard report={data} />
              </div>
            </DeferUntilVisible>
          </section>
          {uniqueBadgeUnlocks.length ? (
            <section id="pr-report-rewards" className="render-opt-section scroll-mt-24">
              <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading reward unlocks" />}>
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
                      {uniqueBadgeUnlocks.map((badge, index) => (
                        <li key={`${badge.key}-${index}`} className="list-none render-opt-card neon-surface rounded-[1.75rem] p-4">
                          <p className="text-lg font-semibold text-white">{badge.name}</p>
                          {badge.description ? <p className="mt-2 text-sm text-muted">{badge.description}</p> : null}
                          <p className="mt-3 text-xs text-emerald-100">
                            Rule {badge.ruleVersion ?? badge.rule ?? "persisted badge evidence"}
                          </p>
                          {badge.evidenceSignals.length ? (
                            <ul role="list" className="mt-3 flex flex-wrap gap-2">
                              {badge.evidenceSignals.slice(0, 3).map((signal, signalIndex) => (
                                <li key={`${badge.key}-${signal}-${signalIndex}`} className="list-none">
                                  <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                                    {signal}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </GlowCard>
                </div>
              </DeferUntilVisible>
            </section>
          ) : null}
        </div>
      ) : null}
      {data.suggestedQuestId ? (
        <section
          id={!uniqueBadgeUnlocks.length ? "pr-report-rewards" : undefined}
          className={!uniqueBadgeUnlocks.length ? "render-opt-section scroll-mt-24" : "render-opt-section"}
        >
          <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading next quest recommendation" />}>
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
                  {suggestedQuest?.evidenceSignals.length ? (
                    <ul role="list" className="mt-3 flex flex-wrap gap-2">
                      {suggestedQuest.evidenceSignals.slice(0, 3).map((signal, index) => (
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
                  <Link href="/dashboard/quests">
                    Open quest board
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </GlowCard>
            </div>
          </DeferUntilVisible>
        </section>
      ) : null}
    </div>
  );
}

function PRReportSectionPlaceholder({ title }: { title: string }) {
  return (
    <GlowCard className="space-y-4">
      <p className="text-xs font-medium text-primary">{title}</p>
      <div className="neon-skeleton h-8 w-2/3 rounded-[0.1rem]" />
      <div className="space-y-2">
        <div className="neon-skeleton h-4 w-full rounded-[0.1rem]" />
        <div className="neon-skeleton h-4 w-11/12 rounded-[0.1rem]" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="neon-skeleton h-24 rounded-[0.1rem]" />
        <div className="neon-skeleton h-24 rounded-[0.1rem]" />
      </div>
    </GlowCard>
  );
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
  if (normalized === "hybrid") {
    return "gemini + deterministic";
  }
  if (normalized === "ai_assisted") {
    return "gemini";
  }
  if (normalized === "deterministic") {
    return "deterministic";
  }
  if (normalized.length === 0 || normalized === "unknown") {
    if (fallbackDetail) {
      return `deterministic fallback (${fallbackDetail})`;
    }
    if (deterministicOnly || hasPersistedScoreEvidence) {
      return "deterministic";
    }
    return "processing";
  }
  return normalized;
}

function summarizeEvidenceReasons(reasons: string[], evidenceAnchored: boolean): string | null {
  if (!reasons.length) {
    return null;
  }
  const normalized = reasons
    .map((reason) => normalizeEvidenceReason(reason, evidenceAnchored))
    .filter((reason): reason is string => Boolean(reason));
  if (!normalized.length) {
    return null;
  }
  return normalized.slice(0, 2).join(" · ");
}

function normalizeEvidenceReason(reason: string, evidenceAnchored: boolean): string | null {
  const normalized = reason.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes("analysis is deterministic-only; no ai enrichment is attached")) {
    return "Deterministic report is available now.";
  }
  if (normalized.includes("analysis has not been persisted")) {
    return evidenceAnchored ? "Deterministic evidence is available now." : "Gemini analysis is still processing.";
  }
  if (normalized.includes("report is stale until analysis and scoring both complete")) {
    return evidenceAnchored ? null : "Report refresh is pending the next scoring replay.";
  }
  if (normalized.includes("fallback reason")) {
    return null;
  }
  return reason;
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
