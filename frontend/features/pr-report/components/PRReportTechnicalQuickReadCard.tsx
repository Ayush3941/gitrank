"use client";

import { GlowCard } from "@/components/shared/GlowCard";
import type { Contribution } from "@/types/gitrank";

export function PRReportTechnicalQuickReadCard({
  contribution,
}: {
  contribution: Contribution;
}) {
  return (
    <GlowCard className="space-y-4">
      <p className="text-xs font-medium text-primary">Quick read</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickReadMetric label="Difficulty" value={contribution.difficultyScore} />
        <QuickReadMetric label="Impact" value={contribution.impactScore} />
        <QuickReadMetric label="Review depth" value={contribution.reviewDepthScore} />
        <QuickReadMetric label="Test signal" value={contribution.testSignalScore} />
      </div>
      <p className="text-xs text-muted">
        Open details for full math, evidence signals, and badge rewards.
      </p>
    </GlowCard>
  );
}

function QuickReadMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
