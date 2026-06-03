import { Check, GitMerge, Link2, ShieldCheck, TestTube2 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function EvidenceSignalsCard({ report }: { report: PullRequestAnalysis }) {
  const contribution = report.contribution;
  const allSignals = buildEvidenceSignalChips(contribution.evidenceSignals);
  const visibleSignals = allSignals.slice(0, 8);
  const remainingSignals = Math.max(0, allSignals.length - visibleSignals.length);
  const signals = [
    { label: "Maintainer reviewed", active: contribution.maintainerReviewed, icon: ShieldCheck },
    { label: "Linked issue", active: contribution.linkedIssue, icon: Link2 },
    { label: "Tests added", active: contribution.testSignalScore >= 50, icon: TestTube2 },
    { label: "Runtime or service code changed", active: contribution.category !== "Documentation", icon: GitMerge },
    { label: "Docs updated", active: contribution.category === "Documentation", icon: Check },
    { label: "CI passed", active: contribution.ciPassed, icon: Check },
  ];

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Evidence signals</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Proof checks</h2>
      </div>
      <ul role="list" className="grid gap-3 md:grid-cols-2">
        {signals.map((signal, index) => {
          const Icon = signal.icon;
          return (
            <li key={`${signal.label}-${index}`} className="list-none neon-surface flex items-center gap-3 rounded-[var(--radius-universal)] px-4 py-4">
              <div
                className={`rounded-[var(--radius-universal)] p-2 ${
                  signal.active ? "bg-emerald-400/12 text-emerald-200" : "neon-tile text-muted"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-white">{signal.label}</p>
              </div>
              <span
                className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${
                  signal.active
                    ? "neon-chip neon-chip-success text-emerald-100"
                    : "neon-chip neon-chip-muted text-muted"
                }`}
              >
                {signal.active ? "Yes" : "No"}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="neon-surface rounded-[var(--radius-universal)] p-4">
        <h3 className="text-xs font-medium text-primary">Stored evidence labels</h3>
        <ul role="list" className="mt-3 flex flex-wrap gap-2">
          {visibleSignals.map((signal, index) => (
            <li key={`${signal}-${index}`} className="list-none">
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                {signal}
              </span>
            </li>
          ))}
          {remainingSignals > 0 ? (
            <li className="list-none">
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                +{remainingSignals} more
              </span>
            </li>
          ) : null}
        </ul>
      </div>
    </GlowCard>
  );
}
