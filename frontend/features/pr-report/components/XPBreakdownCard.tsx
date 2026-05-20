import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function XPBreakdownCard({ report }: { report: PullRequestAnalysis }) {
  const contribution = report.contribution;
  const fallbackRows = [
    {
      label: "Base PR value",
      value: report.baseValue,
      detail: `${contribution.difficultyScore}/100 difficulty and ${contribution.impactScore}/100 impact.`,
    },
    {
      label: "Merged bonus",
      value: report.mergedBonus,
      detail:
        contribution.status === "merged"
          ? "Merged work receives full verification weight."
          : "Open work earns provisional value only.",
    },
    {
      label: "Review depth bonus",
      value: report.reviewBonus,
      detail: contribution.maintainerReviewed
        ? "Maintainer review was detected."
        : "No maintainer review detected yet.",
    },
    {
      label: "Test impact bonus",
      value: report.testBonus,
      detail: contribution.ciPassed
        ? "CI passed and test signal contributed."
        : "CI proof was missing or incomplete.",
    },
    {
      label: "Repo weight bonus",
      value: report.repoBonus,
      detail: `Repository context multiplier ${contribution.repoWeight.toFixed(2)}x.`,
    },
    {
      label: "AI confidence estimate",
      value: `${Math.round(report.aiConfidence * 100)}%`,
      detail:
        "AI assists classification only; deterministic scoring owns final XP.",
    },
  ];
  const rows = report.scoreComponents.length
    ? report.scoreComponents.map((component) => ({
        label: component.label,
        value: component.displayValue,
        detail: `${component.reason} Source: ${component.source}.`,
      }))
    : fallbackRows;

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">
          XP calculation
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">
          {report.scoreComponents.length
            ? "Persisted scorer components"
            : "Transparent formula"}
        </h2>
      </div>
      <ul role="list" className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.label}
            className="list-none neon-surface rounded-[1.75rem] px-4 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted">{row.label}</p>
              <p className="text-sm font-semibold text-white">{row.value}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{row.detail}</p>
          </li>
        ))}
        <li className="list-none rounded-[1.75rem] border border-amber-400/18 bg-amber-400/8 px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-amber-50">Anti-spam multiplier</p>
            <p className="text-sm font-semibold text-amber-100">
              {contribution.antiSpamMultiplier.toFixed(2)}x
            </p>
          </div>
          <p className="mt-2 text-xs leading-5 text-amber-100">
            Repeated, shallow, or unreviewed work is capped so XP stays tied to
            meaningful evidence.
          </p>
        </li>
        <li className="list-none rounded-[1.75rem] border border-emerald-400/18 bg-emerald-400/8 px-4 py-4">
          <p className="text-sm font-semibold text-white">Evidence lock</p>
          <p className="mt-2 text-xs leading-5 text-emerald-100">
            This report links XP to PR facts: changed files, review depth, CI
            state, issue linkage, and category signals.
          </p>
        </li>
        {report.penalties.map((penalty) => (
          <li
            key={penalty.label}
            className="list-none rounded-[1.75rem] border border-rose-400/18 bg-rose-400/8 px-4 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-rose-50">{penalty.label}</p>
              <p className="text-sm font-semibold text-rose-100">
                {penalty.deltaXp} XP
              </p>
            </div>
            <p className="mt-2 text-xs leading-5 text-rose-100">
              {penalty.reason}
            </p>
          </li>
        ))}
      </ul>
    </GlowCard>
  );
}
