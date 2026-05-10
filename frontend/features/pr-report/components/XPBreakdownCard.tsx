import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function XPBreakdownCard({ report }: { report: PullRequestAnalysis }) {
  const rows = [
    { label: "Base PR value", value: report.baseValue },
    { label: "Merged bonus", value: report.mergedBonus },
    { label: "Review depth bonus", value: report.reviewBonus },
    { label: "Test impact bonus", value: report.testBonus },
    { label: "Repo weight bonus", value: report.repoBonus },
    { label: "AI confidence estimate", value: `${Math.round(report.aiConfidence * 100)}%` },
  ];

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.24em] text-primary uppercase">XP calculation</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Transparent formula</h2>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-[1.75rem] border border-white/8 bg-white/5 px-4 py-4">
            <p className="text-sm text-slate-200">{row.label}</p>
            <p className="text-sm font-semibold text-white">{row.value}</p>
          </div>
        ))}
        {report.penalties.map((penalty) => (
          <div key={penalty.label} className="flex items-center justify-between rounded-[1.75rem] border border-rose-400/18 bg-rose-400/8 px-4 py-4">
            <p className="text-sm text-rose-50">{penalty.label}</p>
            <p className="text-sm font-semibold text-rose-100">{penalty.deltaXp} XP</p>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}
