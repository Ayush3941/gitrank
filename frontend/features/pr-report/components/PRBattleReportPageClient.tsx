"use client";

import Link from "next/link";
import { ArrowRight, Award, ShieldCheck, Swords } from "lucide-react";
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
        description="This PR either has not been synced, is private, or has not produced a persisted analysis and score report yet."
      />
    );
  }

  const suggestedQuest = data.suggestedQuest;

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
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="h-3.5 w-3.5" />
              Evidence anchored
            </div>
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
      {data.badgeUnlocks.length ? (
        <GlowCard className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-emerald-100 uppercase">
            <Award className="h-3.5 w-3.5" />
            Badge unlocks
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.badgeUnlocks.map((badge) => (
              <div key={badge.key} className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
                <p className="text-lg font-semibold text-white">{badge.name}</p>
                {badge.description ? <p className="mt-2 text-sm text-muted">{badge.description}</p> : null}
                <p className="mt-3 text-xs text-emerald-100">
                  Rule {badge.ruleVersion ?? badge.rule ?? "persisted badge evidence"}
                </p>
                {badge.evidenceSignals.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {badge.evidenceSignals.slice(0, 3).map((signal) => (
                      <span key={signal} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {signal}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </GlowCard>
      ) : null}
      {data.suggestedQuestId ? (
        <GlowCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
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
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestedQuest.evidenceSignals.slice(0, 3).map((signal) => (
                  <span key={signal} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                    {signal}
                  </span>
                ))}
              </div>
            ) : null}
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
