import Link from "next/link";
import { ArrowRight, BookCheck, GitMerge, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import type { ContributionNarrative } from "@/lib/ai/abra-insights-types";
import type { Contribution } from "@/types/gitrank";

export function ContributionList({
  items,
  narratives,
  isBusy,
}: {
  items: Contribution[];
  narratives?: Record<string, ContributionNarrative>;
  isBusy?: boolean;
}) {
  return (
    <div className="grid gap-4" aria-busy={isBusy || undefined}>
      {items.map((item) => (
        <GlowCard
          key={item.id}
          className="render-opt-card relative space-y-4"
        >
          <div className="h-px w-28 bg-gradient-to-r from-primary/62 via-primary-2/42 to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="break-anywhere text-sm text-muted">{item.owner}/{item.repo} #{item.number}</p>
              <h2 className="mt-2 break-anywhere text-xl font-semibold text-white">{item.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs cyber-copy">
                <span className="neon-chip neon-chip-info rounded-full px-3 py-1.5 font-semibold">{item.category}</span>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 font-semibold uppercase">{item.status}</span>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 font-semibold">{item.changedFilesCount} files changed</span>
                {item.evidenceState ? (
                  <span className="neon-chip rounded-full px-3 py-1.5 font-semibold">
                    Evidence {item.evidenceState}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-[0.24em] text-primary uppercase">Earned</p>
              <p className="numeric-readout mt-2 text-3xl font-semibold text-white">{item.xpEarned} XP</p>
            </div>
          </div>
          <AIPanel
            fallbackSummary={item.aiSummary}
            narrative={narratives?.[item.id]}
          />
          {hasDetailedMetrics(item) ? (
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Difficulty" value={item.difficultyScore} />
              <Metric label="Impact" value={item.impactScore} />
              <Metric label="Review depth" value={item.reviewDepthScore} />
              <Metric label="Test signal" value={item.testSignalScore} />
            </div>
          ) : (
            <div className="neon-surface rounded-[1.75rem] border-dashed p-4 text-sm text-muted">
              This live profile row comes from persisted score-history evidence. Formula version:{" "}
              {item.formulaVersion || "not recorded"}.{" "}
              {item.evidenceMissing?.length
                ? `Missing evidence links: ${item.evidenceMissing.join(", ")}.`
                : "Score event, PR, and analysis links are present."}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            {hasDetailedMetrics(item) ? (
              <>
                <div className="flex flex-wrap gap-4">
                  <span className="inline-flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-primary" />
                    Repo weight {item.repoWeight.toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Anti-spam {item.antiSpamMultiplier.toFixed(2)}x
                  </span>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/pr/${item.owner}/${item.repo}/${item.number}`}>
                    View battle report
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <span>Score-history snapshot evidence</span>
            )}
          </div>
        </GlowCard>
      ))}
    </div>
  );
}

function hasDetailedMetrics(item: Contribution) {
  return (
    item.difficultyScore > 0 ||
    item.impactScore > 0 ||
    item.reviewDepthScore > 0 ||
    item.testSignalScore > 0 ||
    item.changedFilesCount > 0
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="neon-metric rounded-3xl px-4 py-3">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <p className="numeric-readout mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function AIPanel({
  narrative,
  fallbackSummary,
}: {
  narrative?: ContributionNarrative;
  fallbackSummary: string;
}) {
  return (
    <div className="neon-surface rounded-[1.35rem] border-fuchsia-300/28 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-xs tracking-[0.24em] text-fuchsia-200 uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          Contribution Impact Explanation
        </p>
        <CopyTextButton
          text={narrative?.pitch || fallbackSummary}
          label="Copy statement"
          copiedLabel="Statement copied"
          analyticsTarget="contributions/copy-impact-statement"
        />
      </div>
      {narrative ? (
        <div className="cyber-copy mt-3 grid gap-2 text-sm">
          <ExpandableText
            text={`What: ${narrative.what}`}
            lines={3}
            minLengthForToggle={150}
            textClassName="break-anywhere"
          />
          <ExpandableText
            text={`Why it matters: ${narrative.why}`}
            lines={3}
            minLengthForToggle={150}
            textClassName="break-anywhere"
          />
          <ExpandableText
            text={`Signal: ${narrative.signal}`}
            lines={3}
            minLengthForToggle={150}
            textClassName="break-anywhere"
          />
          <p className="neon-chip neon-chip-info inline-flex items-start gap-2 break-anywhere rounded-xl px-3 py-2">
            <Zap className="mt-0.5 h-3.5 w-3.5" />
            {narrative.pitch}
          </p>
        </div>
      ) : (
        <div className="mt-3 inline-flex items-start gap-2 text-sm text-slate-200/84">
          <BookCheck className="mt-0.5 h-4 w-4 text-cyan-200" />
          <ExpandableText
            text={fallbackSummary}
            lines={4}
            minLengthForToggle={210}
            textClassName="break-anywhere text-slate-200/84"
          />
        </div>
      )}
    </div>
  );
}
