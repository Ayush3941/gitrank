"use client";

import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { EvidenceSignalsCard } from "@/features/pr-report/components/EvidenceSignalsCard";
import { ScoreMatrixCard } from "@/features/pr-report/components/ScoreMatrixCard";
import { XPBreakdownCard } from "@/features/pr-report/components/XPBreakdownCard";
import { usePrReport } from "@/hooks/use-pr-report";
import { ayushProfile } from "@/lib/mock-data/gitrank";
import type { PreviewMode } from "@/types/gitrank";

export function PRBattleReportPageClient({
  owner,
  repo,
  number,
  preview,
}: {
  owner: string;
  repo: string;
  number: number;
  preview?: PreviewMode;
}) {
  const { data, isLoading, isError } = usePrReport(owner, repo, number, preview);

  if (isLoading) {
    return <LoadingState message="Calculating PR intensity..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Battle report failed"
        description="The score breakdown could not be computed. Retry or return to the contribution drill-down."
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Battle report not found"
        description="This PR either does not exist in the current mock dataset or has not been analyzed yet."
      />
    );
  }

  const nextQuest = ayushProfile.quests.find((quest) => quest.id === data.suggestedQuestId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="PR battle report"
        description="Explainable contribution scoring, not a mysterious number."
      />
      <GlowCard strong className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{data.contribution.owner}/{data.contribution.repo} #{data.contribution.number}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{data.contribution.title}</h1>
            <p className="mt-3 text-sm text-slate-200">
              {data.contribution.status} • {data.contribution.category}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">XP earned</p>
            <p className="mt-2 text-4xl font-semibold text-white">{data.contribution.xpEarned}</p>
          </div>
        </div>
      </GlowCard>
      <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
        <ScoreMatrixCard report={data} />
        <XPBreakdownCard report={data} />
      </div>
      <GlowCard className="space-y-4">
        <p className="text-xs tracking-[0.24em] text-primary uppercase">AI summary</p>
        <p className="text-base leading-8 text-slate-200">{data.contribution.aiSummary}</p>
      </GlowCard>
      <EvidenceSignalsCard report={data} />
      {nextQuest ? (
        <GlowCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
              <Swords className="h-3.5 w-3.5" />
              Suggested next quest
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white">{nextQuest.title}</h2>
            <p className="mt-2 text-sm text-muted">{nextQuest.description}</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/dashboard/quests">
              Open quest board
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </GlowCard>
      ) : null}
    </div>
  );
}
