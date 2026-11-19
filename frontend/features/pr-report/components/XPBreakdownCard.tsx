import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function XPBreakdownCard({ report }: { report: PullRequestAnalysis }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">XP calculation</p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          Persisted scorer components
        </h2>
      </div>
      {report.scoreComponents.length ? (
        <ul role="list" className="space-y-3">
          {report.scoreComponents.map((component) => (
            <li
              key={component.key || `${component.label}:${component.source}`}
              className="list-none neon-surface rounded-[var(--radius-universal)] px-4 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted">{component.label}</p>
                <p className="shrink-0 text-sm font-semibold text-white">
                  {component.displayValue}
                </p>
              </div>
              <p className="break-anywhere mt-2 text-xs leading-5 text-muted">
                {component.reason}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <CompactEmptyState
          eyebrow="Scoring evidence"
          title="Score details unavailable"
          description="No persisted scoring components are attached to this report."
        />
      )}
    </GlowCard>
  );
}
