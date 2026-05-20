import Link from "next/link";
import { ArrowRight, BookCheck, CalendarDays, GitMerge, ShieldCheck, Sparkles, Zap } from "lucide-react";
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
  totalCount,
  startPosition = 1,
}: {
  items: Contribution[];
  narratives?: Record<string, ContributionNarrative>;
  isBusy?: boolean;
  totalCount?: number;
  startPosition?: number;
}) {
  const fullSetCount = Math.max(items.length, totalCount ?? items.length);
  const isPartialSet = fullSetCount > items.length;

  return (
    <ol className="grid gap-4" aria-busy={isBusy || undefined}>
      {items.map((item, index) => {
        const tier = contributionTier(item);
        const position = startPosition + index;
        const detailedMetricsAvailable = hasDetailedMetrics(item);
        const signalIndex = detailedMetricsAvailable
          ? contributionSignalIndex(item)
          : null;
        return (
          <li
            key={item.id}
            className="list-none"
            aria-posinset={isPartialSet ? position : undefined}
            aria-setsize={isPartialSet ? fullSetCount : undefined}
          >
            <GlowCard
              className="render-opt-card relative space-y-4"
            >
              <div className="h-px w-28 bg-gradient-to-r from-primary/62 via-primary-2/42 to-transparent" />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold break-anywhere">
                      {item.owner}/{item.repo}
                    </span>
                    <span className="neon-chip neon-chip-info rounded-full px-3 py-1 font-semibold">
                      PR #{item.number}
                    </span>
                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                      {formatContributionStatus(item.status)}
                    </span>
                  </div>
                  <h3 className="mt-2 break-anywhere text-xl font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-muted">
                    {formatContributionTimeline(item)}
                  </p>
                  <ul role="list" className="mt-3 flex flex-wrap gap-2 text-xs cyber-copy">
                    <li className="list-none">
                      <span className={`neon-chip rounded-full px-3 py-1.5 font-semibold ${tier.className}`}>{tier.label}</span>
                    </li>
                    <li className="list-none">
                      <span className="neon-chip neon-chip-info rounded-full px-3 py-1.5 font-semibold">{item.category}</span>
                    </li>
                    <li className="list-none">
                      <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 font-semibold">{item.changedFilesCount} files changed</span>
                    </li>
                    <li className="list-none">
                      <span className="neon-chip neon-chip-muted inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold">
                        <CalendarDays className="h-3 w-3" />
                        {formatContributionDate(item.mergedAt)}
                      </span>
                    </li>
                    {item.maintainerReviewed ? (
                      <li className="list-none">
                        <span className="neon-chip neon-chip-success rounded-full px-3 py-1.5 font-semibold">Maintainer reviewed</span>
                      </li>
                    ) : null}
                    {item.ciPassed ? (
                      <li className="list-none">
                        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1.5 font-semibold">CI passed</span>
                      </li>
                    ) : null}
                    {item.evidenceState ? (
                      <li className="list-none">
                        <span className="neon-chip rounded-full px-3 py-1.5 font-semibold">
                          Evidence {item.evidenceState}
                        </span>
                      </li>
                    ) : null}
                  </ul>
                </div>
                <div className="neon-surface rounded-[1.25rem] border-primary/28 px-4 py-3 text-right">
                  <p className="text-xs font-medium text-primary">Earned</p>
                  <p className="numeric-readout mt-2 text-3xl font-semibold text-white">{item.xpEarned} XP</p>
                  {signalIndex !== null ? (
                    <p className="mt-2 text-xs text-muted">
                      Signal index {signalIndex}
                    </p>
                  ) : null}
                </div>
              </div>
              <AIPanel
                fallbackSummary={item.aiSummary}
                narrative={narratives?.[item.id]}
              />
              {detailedMetricsAvailable ? (
                <SignalProfile item={item} />
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
                {detailedMetricsAvailable ? (
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
                      <Link href={`/pr/${item.owner}/${item.repo}/${item.number}`} prefetch={false}>
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
          </li>
        );
      })}
    </ol>
  );
}

function SignalProfile({ item }: { item: Contribution }) {
  const index = contributionSignalIndex(item);
  const rows: Array<{ label: string; value: number }> = [
    { label: "Difficulty", value: item.difficultyScore },
    { label: "Impact", value: item.impactScore },
    { label: "Review depth", value: item.reviewDepthScore },
    { label: "Test signal", value: item.testSignalScore },
  ];

  return (
    <div className="neon-surface rounded-[1.55rem] border-primary/24 p-4">
      <p className="text-xs font-medium text-primary">
        Why this moved your score
      </p>
      <div className="grid gap-3 md:grid-cols-[0.38fr,0.62fr] md:items-start">
        <div className="neon-metric rounded-[1.2rem] px-4 py-3">
          <p className="text-xs font-medium text-primary">
            Signal index
          </p>
          <p className="numeric-readout mt-2 text-3xl font-semibold text-white">{index}</p>
          <p className="mt-1 text-xs text-muted">
            Weighted by impact, review depth, difficulty, and test evidence.
          </p>
          <div className="mt-3 text-xs text-muted">
            <span className="font-medium text-emerald-200">+</span>
            {" "}
            {item.additions} /{" "}
            <span className="font-medium text-rose-200">-</span>
            {" "}
            {item.deletions} lines
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <SignalRow key={`${row.label}-${index}`} label={row.label} value={row.value} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SignalRow({ label, value }: { label: string; value: number }) {
  const normalized = clampScore(value);
  return (
    <div className="neon-tile rounded-[1rem] border-primary/22 px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <p className="text-muted">{label}</p>
        <p className="numeric-readout font-semibold text-white">{Math.round(value)}</p>
      </div>
      <div className="neon-track mt-1.5 h-1.5 rounded-full">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-primary to-primary-2"
          style={{ width: `${normalized}%` }}
        />
      </div>
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

function contributionSignalIndex(item: Contribution): number {
  const impact = clampScore(item.impactScore);
  const review = clampScore(item.reviewDepthScore);
  const difficulty = clampScore(item.difficultyScore);
  const testSignal = clampScore(item.testSignalScore);
  return Math.round(impact * 0.35 + review * 0.25 + difficulty * 0.2 + testSignal * 0.2);
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

type ContributionTier = {
  label: string;
  className: string;
};

function contributionTier(item: Contribution): ContributionTier {
  const weightedScore = item.xpEarned + item.impactScore + item.difficultyScore;
  if (weightedScore >= 420) {
    return { label: "Mythic run", className: "neon-chip-mythic" };
  }
  if (weightedScore >= 280) {
    return { label: "Epic run", className: "neon-chip-warning" };
  }
  if (weightedScore >= 170) {
    return { label: "Rare run", className: "neon-chip-success" };
  }
  return { label: "Solid run", className: "neon-chip-muted" };
}

function formatContributionStatus(status: Contribution["status"]): string {
  if (status === "merged") {
    return "Merged";
  }
  if (status === "open") {
    return "Open";
  }
  return "Closed";
}

function formatContributionDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Date unavailable";
  }
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatContributionTimeline(item: Contribution): string {
  if (item.status === "merged") {
    return `Merged contribution on ${formatContributionDate(item.mergedAt)}.`;
  }
  if (item.status === "open") {
    return `Open contribution snapshot as of ${formatContributionDate(item.mergedAt)}.`;
  }
  return `Closed contribution snapshot as of ${formatContributionDate(item.mergedAt)}.`;
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
        <p className="inline-flex items-center gap-2 text-xs font-medium text-fuchsia-100">
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
          <p className="text-xs font-medium text-primary">Impact statement</p>
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
        <div className="mt-3 inline-flex items-start gap-2 text-sm text-muted">
          <BookCheck className="mt-0.5 h-4 w-4 text-cyan-200" />
          <ExpandableText
            text={fallbackSummary}
            lines={4}
            minLengthForToggle={210}
            textClassName="break-anywhere text-muted"
          />
        </div>
      )}
    </div>
  );
}
