"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, ShieldCheck, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
import { Button } from "@/components/ui/button";
import { EvidenceSignalsCard } from "@/features/pr-report/components/EvidenceSignalsCard";
import { ScoreMatrixCard } from "@/features/pr-report/components/ScoreMatrixCard";
import { XPBreakdownCard } from "@/features/pr-report/components/XPBreakdownCard";
import { usePrReport } from "@/hooks/use-pr-report";
import { formatRelativeDays } from "@/lib/formatters";

type PRReportSectionID =
  | "pr-report-overview"
  | "pr-report-score"
  | "pr-report-ai"
  | "pr-report-evidence"
  | "pr-report-rewards";

const PR_REPORT_SECTION_ITEMS: Array<{ id: PRReportSectionID; label: string }> = [
  { id: "pr-report-overview", label: "Overview" },
  { id: "pr-report-score", label: "Score" },
  { id: "pr-report-ai", label: "AI" },
  { id: "pr-report-evidence", label: "Signals" },
  { id: "pr-report-rewards", label: "Rewards" },
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
  const { data, isLoading, isError } = usePrReport(owner, repo, number);
  const [activeSection, setActiveSection] = useState<PRReportSectionID>("pr-report-overview");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const id = visible.target.id as PRReportSectionID;
        if (id) {
          setActiveSection(id);
        }
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    PR_REPORT_SECTION_ITEMS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => observer.disconnect();
  }, []);

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
        title="Battle report not found"
        description="This PR either has not been synced, is private, or has not produced a persisted analysis and score report yet."
        actionLabel="Open contributions"
        actionHref="/dashboard/contributions"
        analyticsTarget="pr-report:empty"
      />
    );
  }

  const suggestedQuest = data.suggestedQuest;
  const evidenceState = data.evidenceState;
  const evidenceAnchored = evidenceState.status === "complete" || evidenceState.status === "deterministic_only";
  const signalTier =
    data.contribution.xpEarned >= 250
      ? "High signal"
      : data.contribution.xpEarned >= 100
        ? "Medium signal"
        : "Early signal";
  const signalDetail = `${data.contribution.category} • ${data.contribution.changedFilesCount} files changed`;
  const evidenceDetail = evidenceAnchored
    ? "Score is anchored by complete or deterministic evidence."
    : "Score is directional while missing evidence resolves.";
  const nextMoveTitle = suggestedQuest?.title || "Open contribution lane";
  const nextMoveDetail = suggestedQuest?.whyRecommended
    || "Use this report to target stronger review depth, tests, and impact signals in the next PR.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="PR Report"
        title="PR battle report"
        description="Explainable contribution scoring, not a mysterious number."
        actions={(
          <div className="flex flex-wrap gap-2">
            <ThemeQuickSwitcher compact />
            <TextScaleQuickSwitcher compact />
            <Button asChild variant="secondary">
              <Link href="/dashboard/contributions">Back to contributions</Link>
            </Button>
          </div>
        )}
      />
      <div className="neon-callout rounded-[1.75rem] px-4 py-3 text-sm text-slate-200">
        Report metadata: score version {data.scoreVersion || "unknown"} • analysis version{" "}
        {data.analysisVersion || "unknown"} • source updated{" "}
        {data.sourceUpdatedAt ? formatRelativeDays(data.sourceUpdatedAt) : "unknown"}
        {data.isStale ? " • report snapshot is stale" : ""}
      </div>
      <GlowCard className="grid gap-3 md:grid-cols-3">
        <VerdictTile
          title="Signal tier"
          value={signalTier}
          detail={signalDetail}
        />
        <VerdictTile
          title="Evidence confidence"
          value={evidenceAnchored ? "Anchored" : "Partial"}
          detail={evidenceDetail}
        />
        <VerdictTile
          title="Best next move"
          value={nextMoveTitle}
          detail={nextMoveDetail}
        />
      </GlowCard>
      <nav
        aria-labelledby="pr-report-jump-nav-label"
        className="glass-panel flex flex-wrap items-center gap-2 border border-primary/20 p-2 lg:sticky lg:top-4 lg:z-20"
      >
        <p id="pr-report-jump-nav-label" className="cyber-title px-2 text-[10px] tracking-[0.16em] text-cyan-200 uppercase">Jump to</p>
        {PR_REPORT_SECTION_ITEMS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={activeSection === section.id ? "location" : undefined}
            className={
              activeSection === section.id
                ? "focus-ring cyber-title border border-primary/45 bg-primary/16 px-3 py-1.5 text-[11px] tracking-[0.16em] text-white uppercase"
                : "focus-ring cyber-title border border-transparent px-3 py-1.5 text-[11px] tracking-[0.16em] text-slate-200 uppercase hover:border-primary/28 hover:bg-primary/10"
            }
          >
            {section.label}
          </a>
        ))}
      </nav>
      <section id="pr-report-overview" className="scroll-mt-24">
        <GlowCard strong className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="break-anywhere text-sm text-muted">{data.contribution.owner}/{data.contribution.repo} #{data.contribution.number}</p>
            <h1 className="mt-2 break-anywhere text-3xl font-semibold text-white">{data.contribution.title}</h1>
            <p className="mt-3 text-sm text-slate-200">
              {data.contribution.status} • {data.contribution.category}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs tracking-[0.24em] text-primary uppercase">XP earned</p>
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
          <p className="text-xs tracking-[0.22em] text-muted uppercase">Evidence state</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
              analysis: {evidenceState.analysisSource ?? "unknown"}
            </span>
            {typeof evidenceState.analysisConfidence === "number" ? (
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                confidence {Math.round(evidenceState.analysisConfidence * 100)}%
              </span>
            ) : null}
            {evidenceState.missingEvidence.map((missing) => (
              <span key={missing} className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-100">
                missing {missing.replace("_", " ")}
              </span>
            ))}
          </div>
          {evidenceState.reasons.length ? (
            <ExpandableText
              text={evidenceState.reasons.slice(0, 2).join(" · ")}
              lines={2}
              minLengthForToggle={160}
              className="mt-3"
              textClassName="break-anywhere text-sm text-muted"
            />
          ) : null}
        </div>
        </GlowCard>
      </section>
      <section id="pr-report-score" className="scroll-mt-24">
        <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
          <ScoreMatrixCard report={data} />
          <XPBreakdownCard report={data} />
        </div>
      </section>
      <section id="pr-report-ai" className="scroll-mt-24">
        <GlowCard className="space-y-4">
          <p className="text-xs tracking-[0.24em] text-primary uppercase">AI summary</p>
          <ExpandableText
            text={data.contribution.aiSummary}
            lines={5}
            minLengthForToggle={260}
            textClassName="break-anywhere text-base leading-8 text-slate-200"
          />
        </GlowCard>
      </section>
      <section id="pr-report-evidence" className="scroll-mt-24">
        <EvidenceSignalsCard report={data} />
      </section>
      {data.badgeUnlocks.length ? (
        <section id="pr-report-rewards" className="scroll-mt-24">
          <GlowCard className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-emerald-100 uppercase">
            <Award className="h-3.5 w-3.5" />
            Badge unlocks
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.badgeUnlocks.map((badge) => (
              <div key={badge.key} className="neon-surface rounded-[1.75rem] p-4">
                <p className="text-lg font-semibold text-white">{badge.name}</p>
                {badge.description ? <p className="mt-2 text-sm text-muted">{badge.description}</p> : null}
                <p className="mt-3 text-xs text-emerald-100">
                  Rule {badge.ruleVersion ?? badge.rule ?? "persisted badge evidence"}
                </p>
                {badge.evidenceSignals.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {badge.evidenceSignals.slice(0, 3).map((signal) => (
                      <span key={signal} className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                        {signal}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          </GlowCard>
        </section>
      ) : null}
      {data.suggestedQuestId ? (
        <section
          id={!data.badgeUnlocks.length ? "pr-report-rewards" : undefined}
          className={!data.badgeUnlocks.length ? "scroll-mt-24" : undefined}
        >
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
                  <span key={signal} className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
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
        </section>
      ) : null}
    </div>
  );
}

function VerdictTile({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="neon-surface space-y-2 px-4 py-3">
      <p className="text-xs tracking-[0.22em] text-primary uppercase">{title}</p>
      <p className="break-anywhere text-lg font-semibold text-white">{value}</p>
      <ExpandableText
        text={detail}
        lines={3}
        minLengthForToggle={130}
        textClassName="break-anywhere text-xs leading-6 text-muted"
      />
    </div>
  );
}
