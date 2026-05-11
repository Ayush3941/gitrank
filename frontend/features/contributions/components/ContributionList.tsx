import Link from "next/link";
import { ArrowRight, GitMerge, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";
import type { Contribution } from "@/types/gitrank";

export function ContributionList({ items }: { items: Contribution[] }) {
  return (
    <div className="grid gap-4">
      {items.map((item) => (
        <GlowCard key={item.id} className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted">{item.owner}/{item.repo} #{item.number}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{item.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-200">
                <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">{item.category}</span>
                <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">{item.status}</span>
                <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1.5">{item.changedFilesCount} files changed</span>
                {item.evidenceState ? (
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-primary">
                    Evidence {item.evidenceState}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs tracking-[0.24em] text-primary uppercase">Earned</p>
              <p className="mt-2 text-3xl font-semibold text-white">{item.xpEarned} XP</p>
            </div>
          </div>
          {hasDetailedMetrics(item) ? (
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Difficulty" value={item.difficultyScore} />
              <Metric label="Impact" value={item.impactScore} />
              <Metric label="Review depth" value={item.reviewDepthScore} />
              <Metric label="Test signal" value={item.testSignalScore} />
            </div>
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-white/12 bg-white/4 p-4 text-sm text-muted">
              This live profile row comes from persisted score-history evidence. Formula version:{" "}
              {item.formulaVersion || "not recorded"}.{" "}
              {item.evidenceMissing?.length
                ? `Missing evidence links: ${item.evidenceMissing.join(", ")}.`
                : "Score event, PR, and analysis links are present."}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            {hasDetailedMetrics(item) ? (
              <>
                <div className="flex flex-wrap gap-4">
                  <span className="inline-flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-primary" />
                    Repo weight {item.repoWeight.toFixed(2)}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Anti-spam {item.antiSpamMultiplier.toFixed(2)}x
                  </span>
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/pr/${item.owner}/${item.repo}/${item.number}`}>
                    View battle report
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <span>Score-history snapshot evidence</span>
            )}
          </div>
        </GlowCard>
      ))}
    </div>
  );
}

function hasDetailedMetrics(item: Contribution) {
  return (
    item.difficultyScore > 0 ||
    item.impactScore > 0 ||
    item.reviewDepthScore > 0 ||
    item.testSignalScore > 0 ||
    item.changedFilesCount > 0
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
