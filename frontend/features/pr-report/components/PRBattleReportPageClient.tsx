"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";
import { NewTabHint } from "@/components/shared/NewTabHint";
import { PageHeader } from "@/components/shared/PageHeader";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { Button } from "@/components/ui/button";
import { usePrReport } from "@/hooks/use-pr-report";
import {
  formatContributionStatusLabel,
  toneForContributionStatus,
} from "@/lib/presentation/contribution-status";
import { formatEvidenceStatusLabel, toneForEvidenceStatus } from "@/lib/presentation/status-tone";
import { DeterministicMetricsLedgerCard } from "@/features/pr-report/components/DeterministicMetricsLedgerCard";
import { PRReportAISummaryCard } from "@/features/pr-report/components/PRReportAISummaryCard";
import { PRReportOverviewCard } from "@/features/pr-report/components/PRReportOverviewCard";
import { PRReportSuggestedQuestCard } from "@/features/pr-report/components/PRReportSuggestedQuestCard";
import { PRReportTechnicalBreakdownSection } from "@/features/pr-report/components/PRReportTechnicalBreakdownSection";
import { buildPRReportPresentation } from "@/features/pr-report/lib/pr-report-presentation";

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
        description="Retry this report fetch, or open the leaderboard while report evidence refreshes."
        onRetry={() => {
          void refetch();
        }}
        fallbackLabel="Open leaderboard"
        fallbackHref="/dashboard/leaderboard"
        analyticsTarget="pr-report:error"
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        eyebrow="PR evidence"
        title="Battle report unavailable"
        description="This PR may still be syncing, may be private, or may not have published score evidence yet."
        actionLabel="Open leaderboard"
        actionHref="/dashboard/leaderboard"
        analyticsTarget="pr-report:empty"
      />
    );
  }

  const suggestedQuest = data.suggestedQuest;
  const evidenceState = data.evidenceState;
  const presentation = buildPRReportPresentation(data);
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
              <Link href="/dashboard/leaderboard" prefetch={false}>Open leaderboard</Link>
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
      <section id="pr-report-overview" data-scroll-target="true" className="render-opt-section">
        <PRReportOverviewCard
          report={data}
          signalTier={presentation.signalTier}
          evidenceAnchored={presentation.evidenceAnchored}
        />
      </section>
      <section
        id="pr-report-ledger"
        data-scroll-target="true"
        className="render-opt-section"
      >
        <DeterministicMetricsLedgerCard report={data} />
      </section>
      {data.aiSummaryVisible !== false ? (
        <section
          id="pr-report-summary"
          data-scroll-target="true"
          className="render-opt-section"
        >
          <PRReportAISummaryCard key={`${owner}/${repo}/${number}`} owner={owner} repo={repo} number={number} />
        </section>
      ) : null}
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
