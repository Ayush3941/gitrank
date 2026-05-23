import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClampedText } from "@/components/shared/ClampedText";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { GlowCard } from "@/components/shared/GlowCard";
import type { ContributionNarrative } from "@/lib/ai/abra-insights-types";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { Contribution } from "@/types/gitrank";

export function ContributionList({
  items,
  narratives,
  isBusy,
  totalCount,
  startPosition = 1,
  useLiteCards = false,
  showDetails = true,
}: {
  items: Contribution[];
  narratives?: Record<string, ContributionNarrative>;
  isBusy?: boolean;
  totalCount?: number;
  startPosition?: number;
  useLiteCards?: boolean;
  showDetails?: boolean;
}) {
  const fullSetCount = Math.max(items.length, totalCount ?? items.length);
  const isPartialSet = fullSetCount > items.length;

  return (
    <ol className="grid gap-4" aria-busy={isBusy || undefined}>
      {items.map((item, index) => {
        const tier = contributionTier(item);
        const position = startPosition + index;
        const signalIndex = contributionSignalIndex(item);
        const signalBand = contributionSignalBand(signalIndex);
        const showStatusChip = item.status !== "merged";
        const reportState = contributionReportState(item);
        return (
          <li
            key={`${item.owner}/${item.repo}#${item.number}-${item.id}-${index}`}
            className="list-none"
            aria-posinset={isPartialSet ? position : undefined}
            aria-setsize={isPartialSet ? fullSetCount : undefined}
          >
            <GlowCard className={`render-opt-card ${useLiteCards || !showDetails ? "space-y-3" : "space-y-4"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold break-anywhere">
                      {item.owner}/{item.repo}
                    </span>
                    <span className="neon-chip neon-chip-info rounded-full px-3 py-1 font-semibold">
                      PR #{item.number}
                    </span>
                    {showStatusChip ? (
                      <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                        {formatContributionStatus(item.status)}
                      </span>
                    ) : null}
                    {reportState ? (
                      <span className={`neon-chip rounded-full px-3 py-1 font-semibold ${reportState.className}`}>
                        {reportState.label}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 break-anywhere text-xl font-semibold text-white">{item.title}</h3>
                  <ul role="list" className="mt-3 flex flex-wrap gap-2 text-xs cyber-copy">
                    <li className="list-none">
                      <span className={`neon-chip rounded-full px-3 py-1.5 font-semibold ${tier.className}`}>{tier.label}</span>
                    </li>
                    <li className="list-none">
                      <span className="neon-chip neon-chip-info rounded-full px-3 py-1.5 font-semibold">{item.category}</span>
                    </li>
                    {!useLiteCards && showDetails ? (
                      <li className="list-none">
                        <span className="neon-chip neon-chip-muted inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold">
                          <CalendarDays className="h-3 w-3" />
                          {formatContributionDate(item.mergedAt)}
                        </span>
                      </li>
                    ) : null}
                    {showDetails && item.maintainerReviewed ? (
                      <li className="list-none">
                        <span className="neon-chip neon-chip-success rounded-full px-3 py-1.5 font-semibold">Maintainer reviewed</span>
                      </li>
                    ) : null}
                  </ul>
                </div>
                <div className={`neon-surface border-primary/28 text-right ${useLiteCards ? "rounded-[1rem] px-3 py-2.5" : "rounded-[1.25rem] px-4 py-3"}`}>
                  <p className="text-xs font-medium text-primary">Earned</p>
                  <p className="numeric-readout mt-2 text-3xl font-semibold text-white">{item.xpEarned} XP</p>
                  {!useLiteCards && showDetails ? (
                    <>
                      <p className="mt-2 text-xs text-muted">Signal {signalBand.label}</p>
                      <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full border border-primary/24 bg-card/80">
                        <div
                          className={`h-full rounded-full ${signalBand.barClassName}`}
                          style={{ width: `${signalIndex}%` }}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
              {showDetails ? (
                <AIPanel
                  fallbackSummary={item.aiSummary}
                  narrative={narratives?.[item.id]}
                  lite={useLiteCards}
                />
              ) : null}
              <div className="flex justify-end">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/pr/${item.owner}/${item.repo}/${item.number}`} prefetch={false}>
                    View report
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </GlowCard>
          </li>
        );
      })}
    </ol>
  );
}

function contributionSignalIndex(item: Contribution): number {
  const impact = clampScore(item.impactScore);
  const review = clampScore(item.reviewDepthScore);
  const difficulty = clampScore(item.difficultyScore);
  const testSignal = clampScore(item.testSignalScore);
  return Math.round(impact * 0.35 + review * 0.25 + difficulty * 0.2 + testSignal * 0.2);
}

function contributionReportState(
  item: Contribution,
): { label: string; className: string } | null {
  const status = item.reportEvidenceStatus;
  if (status === "complete") {
    const analysisSource = (item.reportAnalysisSource ?? "").toLowerCase();
    if (analysisSource.includes("ai") || analysisSource.includes("gemini") || analysisSource.includes("hybrid")) {
      return { label: "Gemini ready", className: "neon-chip-success" };
    }
    return { label: "Deterministic ready", className: "neon-chip-info" };
  }
  if (status === "deterministic_only") {
    return { label: "Deterministic", className: "neon-chip-info" };
  }
  if (status === "ai_fallback") {
    return { label: "AI fallback", className: "neon-chip-warning" };
  }
  if (status === "rate_limited") {
    return { label: "Rate limited", className: "neon-chip-warning" };
  }
  if (status === "stale") {
    return { label: "Pending refresh", className: "neon-chip-muted" };
  }
  if (status === "incomplete" || item.evidenceState === "partial") {
    return { label: "Evidence partial", className: "neon-chip-muted" };
  }
  return null;
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

type ContributionSignalBand = {
  label: string;
  barClassName: string;
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

function contributionSignalBand(signalIndex: number): ContributionSignalBand {
  if (signalIndex >= 75) {
    return { label: "High", barClassName: "bg-gradient-to-r from-emerald-300 to-cyan-300" };
  }
  if (signalIndex >= 45) {
    return { label: "Rising", barClassName: "bg-gradient-to-r from-cyan-300 to-blue-300" };
  }
  return { label: "Early", barClassName: "bg-gradient-to-r from-amber-300 to-fuchsia-300" };
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

function AIPanel({
  narrative,
  fallbackSummary,
  lite = false,
}: {
  narrative?: ContributionNarrative;
  fallbackSummary: string;
  lite?: boolean;
}) {
  const summary = sanitizeReportSummary(narrative?.pitch || fallbackSummary);

  return (
      <div className={`neon-surface border-fuchsia-300/28 ${lite ? "rounded-[1rem] px-3 py-3" : "rounded-[1.35rem] px-4 py-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-xs font-medium text-fuchsia-100">
          <Sparkles className="h-3.5 w-3.5" />
          Impact summary
        </p>
        {!lite ? (
          <CopyTextButton
            text={summary}
            label="Copy impact"
            copiedLabel="Impact copied"
            manualLabel="Copy manually"
            errorLabel="Copy failed"
            analyticsTarget="contributions/impact-summary"
            size="sm"
            variant="ghost"
          />
        ) : null}
      </div>
      <div className="mt-3 text-sm text-muted">
        <ClampedText text={summary} lines={lite ? 1 : 2} className="text-muted" />
      </div>
      {narrative && !lite ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-cyan-100">Why it matters</p>
          <ClampedText text={narrative.why} lines={2} className="text-sm text-muted" />
        </div>
      ) : null}
    </div>
  );
}
