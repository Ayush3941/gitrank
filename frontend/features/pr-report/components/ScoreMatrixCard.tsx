import { GlowCard } from "@/components/shared/GlowCard";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function ScoreMatrixCard({ report }: { report: PullRequestAnalysis }) {
  const contribution = report.contribution;

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.24em] text-primary uppercase">Score matrix</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">What drove the XP</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Difficulty" value={contribution.difficultyScore} />
        <Metric label="Impact" value={contribution.impactScore} />
        <Metric label="Review depth" value={contribution.reviewDepthScore} />
        <Metric label="Test signal" value={contribution.testSignalScore} />
        <Metric label="Repo weight" value={contribution.repoWeight.toFixed(2)} />
        <Metric label="Anti-spam" value={`${contribution.antiSpamMultiplier.toFixed(2)}x`} />
      </div>
    </GlowCard>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[1.75rem] border border-white/8 bg-white/5 px-4 py-4">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
