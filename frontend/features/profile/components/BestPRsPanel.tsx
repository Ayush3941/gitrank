import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { FeaturedContribution } from "@/types/gitrank";

export function BestPRsPanel({ reports }: { reports: FeaturedContribution[] }) {
  const uniqueReports = deduplicateFeaturedContributionsByPR(reports);

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Best PRs</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Highest-signal contributions</h2>
      </div>
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="neon-surface rounded-[1.75rem] border-dashed border-primary/24 p-4 text-sm text-muted">
            <p>Exact pull request evidence is hidden on this profile or there are no scored contributions yet.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/contributions" prefetch={false}>Open contributions lane</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ol role="list" className="space-y-3">
            {uniqueReports.slice(0, 5).map((report, index) => (
            <li
              key={`${report.owner}/${report.repo}#${report.number}-${report.id}-${index}`}
              className="render-opt-card neon-surface cyber-sheen rounded-[1.75rem] border-cyan-300/18 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="break-anywhere text-sm text-muted">
                    {report.owner}/{report.repo} #{report.number}
                  </p>
                  <h3 className="mt-2 break-anywhere text-lg font-medium text-white">{report.title}</h3>
                  <ExpandableText
                    text={sanitizeReportSummary(report.summary)}
                    lines={2}
                    minLengthForToggle={180}
                    className="mt-2"
                    textClassName="break-anywhere text-sm text-muted"
                  />
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-primary">XP</p>
                  <p className="numeric-readout mt-2 text-2xl font-semibold text-white">
                    {report.xpEarned.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/pr/${report.owner}/${report.repo}/${report.number}`} prefetch={false}>
                    View report
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </li>
            ))}
          </ol>
        )}
      </div>
    </GlowCard>
  );
}

function deduplicateFeaturedContributionsByPR(
  reports: FeaturedContribution[],
): FeaturedContribution[] {
  const bestByPR = new Map<string, FeaturedContribution>();

  for (const report of reports) {
    const key = `${report.owner}/${report.repo}#${report.number}`;
    const existing = bestByPR.get(key);
    if (!existing || report.xpEarned > existing.xpEarned) {
      bestByPR.set(key, report);
    }
  }

  return Array.from(bestByPR.values());
}
