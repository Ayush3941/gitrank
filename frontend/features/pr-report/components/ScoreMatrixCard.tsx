import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function ScoreMatrixCard({ report }: { report: PullRequestAnalysis }) {
  const contribution = report.contribution;

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Score matrix</p>
        <h2 className="mt-2 text-xl font-semibold text-white">What drove the XP</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Final XP" value={contribution.xpEarned} />
        <Metric label="Difficulty" value={contribution.difficultyScore} />
        <Metric label="Impact" value={contribution.impactScore} />
        <Metric label="Review depth" value={contribution.reviewDepthScore} />
        <Metric label="Test signal" value={contribution.testSignalScore} />
        <Metric label="Repo weight" value={contribution.repoWeight.toFixed(2)} />
      </div>
    </GlowCard>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
