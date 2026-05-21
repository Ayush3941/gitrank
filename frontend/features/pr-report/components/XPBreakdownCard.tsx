import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function XPBreakdownCard({ report }: { report: PullRequestAnalysis }) {
  const contribution = report.contribution;
  const fallbackRows = [
    {
      label: "Base PR value",
      value: formatXpValue(report.baseValue),
      detail: `${contribution.difficultyScore}/100 difficulty and ${contribution.impactScore}/100 impact.`,
    },
    {
      label: "Merged bonus",
      value: formatXpValue(report.mergedBonus),
      detail:
        contribution.status === "merged"
          ? "Merged work receives full verification weight."
          : "Open work earns provisional value only.",
    },
    {
      label: "Review depth bonus",
      value: formatXpValue(report.reviewBonus),
      detail: contribution.maintainerReviewed
        ? "Maintainer review was detected."
        : "No maintainer review detected yet.",
    },
    {
      label: "Test impact bonus",
      value: formatXpValue(report.testBonus),
      detail: contribution.ciPassed
        ? "CI passed and test signal contributed."
        : "CI proof was missing or incomplete.",
    },
    {
      label: "Repo weight bonus",
      value: formatXpValue(report.repoBonus),
      detail: `Repository context multiplier ${contribution.repoWeight.toFixed(2)}x.`,
    },
  ];
  const rows = report.scoreComponents.length
    ? report.scoreComponents.map((component) => ({
        label: component.label,
        value: component.displayValue,
        detail: component.reason,
      }))
    : fallbackRows;
  const prioritizedRows = prioritizeFinalXpRow(rows);
  const visibleRows = prioritizedRows.slice(0, 3);
  const remainingRows = Math.max(0, prioritizedRows.length - visibleRows.length);

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">
          XP calculation
        </p>
        <h2 className="mt-2 text-xl font-semibold text-white">
          {report.scoreComponents.length
            ? "Persisted scorer components"
            : "Transparent formula"}
        </h2>
      </div>
      <ul role="list" className="space-y-3">
        {visibleRows.map((row, index) => (
          <li
            key={`${row.label}-${index}`}
            className="list-none neon-surface rounded-[1.75rem] px-4 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted">{row.label}</p>
              <p className="text-sm font-semibold text-white">{row.value}</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{row.detail}</p>
          </li>
        ))}
        {remainingRows > 0 ? (
          <li className="list-none neon-surface rounded-[1.75rem] border-dashed px-4 py-3 text-xs text-muted">
            +{remainingRows} more components available.
          </li>
        ) : null}
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
        {report.penalties.map((penalty, index) => (
          <li
            key={`${penalty.label}-${index}`}
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

function formatXpValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "0 XP";
  }
  const rounded = Math.round(value);
  if (rounded > 0) {
    return `+${rounded} XP`;
  }
  return `${rounded} XP`;
}

function prioritizeFinalXpRow(
  rows: Array<{ label: string; value: string; detail: string }>,
): Array<{ label: string; value: string; detail: string }> {
  if (rows.length <= 3) {
    return rows;
  }
  const finalXpIndex = rows.findIndex((row) => {
    const label = row.label.toLowerCase();
    const detail = row.detail.toLowerCase();
    return label.includes("final xp") || detail.includes("final deterministic xp");
  });
  if (finalXpIndex <= 0) {
    return rows;
  }
  const finalXpRow = rows[finalXpIndex];
  return [finalXpRow, ...rows.slice(0, finalXpIndex), ...rows.slice(finalXpIndex + 1)];
}
