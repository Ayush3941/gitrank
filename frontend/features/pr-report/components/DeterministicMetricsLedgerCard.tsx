"use client";

import { useId, useState } from "react";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";
import { GlowCard } from "@/components/shared/GlowCard";
import { formatNumber, formatPluralCount, formatXp } from "@/lib/formatters";
import { formatContributionStatusLabel } from "@/lib/presentation/contribution-status";
import { formatPRCategoryLabel } from "@/lib/presentation/pr-category-label";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function DeterministicMetricsLedgerCard({
  report,
}: {
  report: PullRequestAnalysis;
}) {
  const [showLedgerNotes, setShowLedgerNotes] = useState(false);
  const ledgerRegionId = useId();
  const ledgerToggleId = useId();

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-primary">Deterministic metrics ledger</p>
          <h2 className="mt-2 text-sm font-semibold text-white">
            Deterministic scoring inputs and outputs
          </h2>
          <p className="mt-2 text-xs text-muted">
            Only metrics used directly by the deterministic score formula are shown here.
          </p>
        </div>
        <DisclosureToggle
          id={ledgerToggleId}
          controlsId={ledgerRegionId}
          expanded={showLedgerNotes}
          onToggle={() => {
            setShowLedgerNotes((current) => !current);
          }}
          collapsedLabel="Show metric notes"
          expandedLabel="Hide metric notes"
        />
      </div>
      <div id={ledgerRegionId} role="region" aria-labelledby={ledgerToggleId} className="space-y-4">
        <LedgerSection
          title="Score outputs"
          description="Final output from deterministic scoring."
          showDescriptions={showLedgerNotes}
          metrics={[
            {
              id: "xp_earned",
              label: "XP earned",
              value: formatXp(report.contribution.xpEarned),
              description: "Final deterministic XP after multipliers and penalties.",
            },
            {
              id: "score_version",
              label: "Score version",
              value: report.scoreVersion || "Score version pending",
              description: "Scoring formula revision used for this result.",
            },
          ]}
        />
        <LedgerSection
          title="Core scoring signals"
          description="Primary inputs used directly by scoring."
          showDescriptions={showLedgerNotes}
          metrics={[
            {
              id: "status",
              label: "Status",
              value: formatContributionStatusLabel(report.contribution.status),
              description: "PR state used by the outcome weight.",
            },
            {
              id: "category",
              label: "Category",
              value: formatPRCategoryLabel(report.contribution.category),
              description: "Detected contribution type.",
            },
            {
              id: "difficulty_score",
              label: "Difficulty score",
              value: String(report.contribution.difficultyScore),
              description: "Complexity signal from size and code surface.",
            },
            {
              id: "impact_score",
              label: "Impact score",
              value: String(report.contribution.impactScore),
              description: "Projected contribution effect.",
            },
            {
              id: "review_depth",
              label: "Review depth",
              value: String(report.contribution.reviewDepthScore),
              description: "Reviewer activity signal.",
            },
            {
              id: "test_signal",
              label: "Test signal",
              value: String(report.contribution.testSignalScore),
              description: "Regression test evidence signal.",
            },
            {
              id: "repo_weight",
              label: "Repo weight",
              value: report.contribution.repoWeight.toFixed(2),
              description: "Repository multiplier in XP math.",
            },
            {
              id: "anti_spam_multiplier",
              label: "Anti-spam multiplier",
              value: `${report.contribution.antiSpamMultiplier.toFixed(2)}x`,
              description: "Caps repeated low-signal contribution patterns.",
            },
          ]}
        />
        <LedgerSection
          title="Change-volume inputs"
          description="Raw change-size inputs used by deterministic analysis."
          showDescriptions={showLedgerNotes}
          metrics={[
            {
              id: "changed_files",
              label: "Changed files",
              value: formatNumber(report.contribution.changedFilesCount),
              description: "File count input.",
            },
            {
              id: "additions",
              label: "Additions",
              value: formatNumber(report.contribution.additions),
              description: "Added line-count input.",
            },
            {
              id: "deletions",
              label: "Deletions",
              value: formatNumber(report.contribution.deletions),
              description: "Deleted line-count input.",
            },
          ]}
        />
      </div>
    </GlowCard>
  );
}

type LedgerMetric = {
  id: string;
  label: string;
  value: string;
  description: string;
};

function LedgerSection({
  title,
  description,
  showDescriptions,
  metrics,
}: {
  title: string;
  description: string;
  showDescriptions: boolean;
  metrics: LedgerMetric[];
}) {
  return (
    <section className="space-y-3 rounded-[var(--radius-universal)] border border-white/10 bg-black/20 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{title}</h3>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-muted">
          {formatPluralCount(metrics.length, "metric")}
        </span>
      </div>
      <p className="text-xs text-muted">{description}</p>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCell
            key={metric.id}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            showDescription={showDescriptions}
          />
        ))}
      </dl>
    </section>
  );
}

function MetricCell({
  label,
  value,
  description,
  showDescription,
}: {
  label: string;
  value: string;
  description: string;
  showDescription: boolean;
}) {
  const descriptionId = useId();

  return (
    <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className="break-anywhere mt-1 text-sm font-semibold text-white"
        aria-describedby={descriptionId}
      >
        {value}
      </dd>
      <dd
        id={descriptionId}
        className={
          showDescription ? "break-anywhere mt-2 text-xs leading-5 text-muted" : "sr-only"
        }
      >
        {description}
      </dd>
    </div>
  );
}
