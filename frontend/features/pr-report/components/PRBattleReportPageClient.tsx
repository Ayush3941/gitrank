"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { NewTabHint } from "@/components/shared/NewTabHint";
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
import { formatEvidenceStatusLabel, toneForEvidenceStatus } from "@/lib/presentation/status-tone";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";
import { DeterministicMetricsLedgerCard } from "@/features/pr-report/components/DeterministicMetricsLedgerCard";
import { PRReportImpactSummaryCard } from "@/features/pr-report/components/PRReportImpactSummaryCard";
import { PRReportOverviewCard } from "@/features/pr-report/components/PRReportOverviewCard";
import { PRReportSuggestedQuestCard } from "@/features/pr-report/components/PRReportSuggestedQuestCard";
import { PRReportTechnicalBreakdownSection } from "@/features/pr-report/components/PRReportTechnicalBreakdownSection";
import { ReportProcessingStateCard } from "@/features/pr-report/components/ReportProcessingStateCard";
import {
  buildPRReportPresentation,
  buildRetryAiSummaryNotice,
} from "@/features/pr-report/lib/pr-report-presentation";

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
  const presentation = buildPRReportPresentation(data);

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
          signalTier={presentation.signalTier}
          evidenceAnchored={presentation.evidenceAnchored}
          hasPersistedScoreEvidence={presentation.hasPersistedScoreEvidence}
          fallbackDetail={presentation.fallbackDetail}
          evidenceReasonSummary={presentation.evidenceReasonSummary}
          showEvidenceReasonSummary={presentation.showEvidenceReasonSummary}
        />
      </section>
      <section
        id="pr-report-ledger"
        data-scroll-target="true"
        className="render-opt-section"
      >
        <DeterministicMetricsLedgerCard report={data} />
      </section>
      {presentation.reportStateGuidance ? (
        <ReportProcessingStateCard
          guidance={presentation.reportStateGuidance}
          canRetryAiSummary={presentation.canRetryAiSummary}
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
          label={presentation.summarySectionLabel}
          summary={presentation.reportSummary}
          fallbackDetail={presentation.fallbackDetail}
        />
      </section>
      <PRReportTechnicalBreakdownSection
        report={data}
        badgeRewards={presentation.uniqueBadgeUnlocks}
      />
      {data.suggestedQuestId ? (
        <PRReportSuggestedQuestCard
          questId={data.suggestedQuestId}
          title={suggestedQuest?.title}
          whyRecommended={suggestedQuest?.whyRecommended}
          signals={presentation.suggestedQuestSignals}
        />
      ) : null}
    </div>
  );
}
