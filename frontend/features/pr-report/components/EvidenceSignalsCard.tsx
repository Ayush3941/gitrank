import { Check, GitMerge, Link2, ShieldCheck, TestTube2 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function EvidenceSignalsCard({ report }: { report: PullRequestAnalysis }) {
  const contribution = report.contribution;
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
        <h2 className="mt-2 text-2xl font-semibold text-white">Why this PR earned what it earned</h2>
      </div>
      <ul role="list" className="grid gap-3 md:grid-cols-2">
        {signals.map((signal, index) => {
          const Icon = signal.icon;
          return (
            <li key={`${signal.label}-${index}`} className="list-none neon-surface flex items-center gap-3 rounded-[1.75rem] px-4 py-4">
              <div
                className={`rounded-2xl p-2 ${
                  signal.active ? "bg-emerald-400/12 text-emerald-200" : "neon-tile text-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="font-medium text-white">{signal.label}</p>
                <p className="text-sm text-muted">{signal.active ? "Verified" : "Not detected"}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="neon-surface rounded-[1.75rem] p-4">
        <p className="text-xs font-medium text-primary">Stored evidence labels</p>
        <ul role="list" className="mt-3 flex flex-wrap gap-2">
          {contribution.evidenceSignals.map((signal, index) => (
            <li key={`${signal}-${index}`} className="list-none">
              <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                {signal}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlowCard>
  );
}
