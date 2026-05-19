"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Award, ShieldCheck, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { SectionJumpNav } from "@/components/shared/SectionJumpNav";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
import { ConstrainedNetworkPill } from "@/components/shared/ConstrainedNetworkPill";
import { Button } from "@/components/ui/button";
import { EvidenceSignalsCard } from "@/features/pr-report/components/EvidenceSignalsCard";
import { ScoreMatrixCard } from "@/features/pr-report/components/ScoreMatrixCard";
import { XPBreakdownCard } from "@/features/pr-report/components/XPBreakdownCard";
import { usePrReport } from "@/hooks/use-pr-report";
import { formatRelativeDays } from "@/lib/formatters";
import { initialSectionFromHash } from "@/lib/section-nav";

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
const PR_REPORT_SECTION_IDS = PR_REPORT_SECTION_ITEMS.map(
  (section) => section.id,
) as PRReportSectionID[];
const PR_REPORT_DEFAULT_SECTION: PRReportSectionID = "pr-report-overview";

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
  const [activeSection, setActiveSection] =
    useState<PRReportSectionID>(PR_REPORT_DEFAULT_SECTION);
  const activeSectionLabel =
    PR_REPORT_SECTION_ITEMS.find((section) => section.id === activeSection)?.label ??
    "Overview";
  const activeSectionLink =
    `/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${number}#${activeSection}`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      const nextSection = initialSectionFromHash(
        PR_REPORT_SECTION_IDS,
        PR_REPORT_DEFAULT_SECTION,
        window.location.hash,
      );
      setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const nextSection = initialSectionFromHash(
          PR_REPORT_SECTION_IDS,
          PR_REPORT_DEFAULT_SECTION,
          `#${visible.target.id}`,
        );
        setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    PR_REPORT_SECTION_ITEMS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      observer.disconnect();
    };
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
        eyebrow="PR evidence"
        title="Battle report not found"
        description="This PR either has not been synced, is private, or has not produced a persisted analysis and score report yet."
        actionLabel="Open contributions"
        actionHref="/dashboard/contributions"
        secondaryActionLabel="Open settings"
        secondaryActionHref="/dashboard/settings"
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
        meta={(
          <>
            <SnapshotFreshnessPill
              refreshedAt={data.sourceUpdatedAt}
              label="Report snapshot"
            />
            <ConstrainedNetworkPill />
          </>
        )}
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
      <SectionJumpNav
        navLabelID="pr-report-jump-nav-label"
        landmarkLabel="PR report section navigation"
        activeSectionLabel={activeSectionLabel}
        items={PR_REPORT_SECTION_ITEMS}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
        copyHref={activeSectionLink}
        copyAnalyticsTarget="pr-report/copy-section-link"
        stickyClassName="lg:sticky lg:z-20 sticky-safe-top-4"
      />
      <section id="pr-report-overview" className="scroll-mt-24">
        <GlowCard strong className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="break-anywhere text-sm text-muted">{data.contribution.owner}/{data.contribution.repo} #{data.contribution.number}</p>
            <h2 className="mt-2 break-anywhere text-3xl font-semibold text-white">{data.contribution.title}</h2>
            <p className="mt-3 text-sm text-slate-200">
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
      <section id="pr-report-score" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading score matrix" />}>
          <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
            <ScoreMatrixCard report={data} />
            <XPBreakdownCard report={data} />
          </div>
        </DeferUntilVisible>
      </section>
      <section id="pr-report-ai" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading AI summary lane" />}>
          <GlowCard className="space-y-4">
            <p className="text-xs font-medium text-primary">AI summary</p>
            <ExpandableText
              text={data.contribution.aiSummary}
              lines={5}
              minLengthForToggle={260}
              textClassName="break-anywhere text-base leading-8 text-slate-200"
            />
          </GlowCard>
        </DeferUntilVisible>
      </section>
      <section id="pr-report-evidence" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading evidence signals" />}>
          <EvidenceSignalsCard report={data} />
        </DeferUntilVisible>
      </section>
      {data.badgeUnlocks.length ? (
        <section id="pr-report-rewards" className="render-opt-section scroll-mt-24">
          <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading reward unlocks" />}>
            <GlowCard className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <Award className="h-3.5 w-3.5" />
              Badge unlocks
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {data.badgeUnlocks.map((badge) => (
                <div key={badge.key} className="render-opt-card neon-surface rounded-[1.75rem] p-4">
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
          </DeferUntilVisible>
        </section>
      ) : null}
      {data.suggestedQuestId ? (
        <section
          id={!data.badgeUnlocks.length ? "pr-report-rewards" : undefined}
          className={!data.badgeUnlocks.length ? "render-opt-section scroll-mt-24" : "render-opt-section"}
        >
          <DeferUntilVisible fallback={<PRReportSectionPlaceholder title="Loading next quest recommendation" />}>
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
      <p className="text-xs font-medium text-primary">{title}</p>
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
