import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
          <div className="rounded-[1.75rem] border border-dashed border-white/12 bg-white/3 p-4 text-sm text-muted">
            Exact pull request evidence is hidden on this profile or there are no scored contributions yet.
          </div>
        ) : (
          reports.slice(0, 5).map((report) => (
            <div key={report.id} className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">
                    {report.owner}/{report.repo} #{report.number}
                  </p>
                  <h3 className="mt-2 text-lg font-medium text-white">{report.title}</h3>
                  <p className="mt-2 text-sm text-muted">{report.summary}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs tracking-[0.24em] text-primary uppercase">XP</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{report.xpEarned}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
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
