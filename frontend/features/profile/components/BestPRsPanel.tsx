import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { GlowCard } from "@/components/shared/GlowCard";
import type { FeaturedContribution } from "@/types/gitrank";

export function BestPRsPanel({ reports }: { reports: FeaturedContribution[] }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.24em] text-primary uppercase">Best PRs</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Highest-signal contributions</h2>
      </div>
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="neon-surface rounded-[1.75rem] border-dashed border-primary/24 p-4 text-sm text-muted">
            Exact pull request evidence is hidden on this profile or there are no scored contributions yet.
          </div>
        ) : (
          reports.slice(0, 5).map((report) => (
            <div key={report.id} className="render-opt-card neon-surface cyber-sheen rounded-[1.75rem] border-cyan-300/18 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="break-words text-sm text-muted">
                    {report.owner}/{report.repo} #{report.number}
                  </p>
                  <h3 className="mt-2 break-words text-lg font-medium text-white">{report.title}</h3>
                  <p className="mt-2 break-words text-sm text-slate-200/84">{report.summary}</p>
                  <p className="neon-chip neon-chip-muted mt-3 inline-flex rounded-full px-3 py-1 text-xs">
                    Evidence {report.evidenceState || "partial"} / Formula {report.formulaVersion || "not recorded"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs tracking-[0.24em] text-primary uppercase">XP</p>
                  <p className="numeric-readout mt-2 text-2xl font-semibold text-white">
                    {report.xpEarned.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <CopyTextButton
                  text={report.summary}
                  label="Copy summary"
                  copiedLabel="Summary copied"
                  analyticsTarget="public-profile/copy-pr-summary"
                />
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/pr/${report.owner}/${report.repo}/${report.number}`}>
                    View report
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </GlowCard>
  );
}
