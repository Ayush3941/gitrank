import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function RecentBattleReports({ reports }: { reports: PullRequestAnalysis[] }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs tracking-[0.24em] text-primary uppercase">Recent battle reports</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">High-signal PRs from the last cycle</h2>
      </div>
      <div className="grid gap-3">
        {reports.length === 0 ? (
          <div className="neon-surface rounded-[1.75rem] border-dashed p-4 text-sm text-muted">
            No persisted PR battle reports are attached to this profile snapshot yet. Direct report URLs will appear here after scoring writes score events with public PR evidence.
          </div>
        ) : null}
        {reports.map((report) => (
          <div key={report.contribution.id} className="neon-surface rounded-[1.75rem] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="break-words text-sm text-muted">{report.contribution.owner}/{report.contribution.repo} #{report.contribution.number}</p>
                <h3 className="mt-2 break-words text-lg font-medium text-white">{report.contribution.title}</h3>
                <p className="mt-2 text-sm text-muted">
                  {report.contribution.category} • difficulty {report.contribution.difficultyScore} • {report.contribution.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs tracking-[0.24em] text-primary uppercase">XP earned</p>
                <p className="numeric-readout mt-2 text-3xl font-semibold text-white">
                  {report.contribution.xpEarned.toLocaleString("en-US")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/pr/${report.contribution.owner}/${report.contribution.repo}/${report.contribution.number}`}>
                  View report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}
