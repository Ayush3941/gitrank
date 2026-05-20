import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function RecentBattleReports({ reports }: { reports: PullRequestAnalysis[] }) {
  const sortedReports = [...reports].sort(
    (left, right) => right.contribution.xpEarned - left.contribution.xpEarned,
  );

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Recent battle reports</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">High-signal PRs from the last cycle</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
            {reports.length} report rows
          </span>
          <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
            Sorted by XP impact
          </span>
        </div>
      </div>
      <ul role="list" className="grid gap-3">
        {reports.length === 0 ? (
          <li className="list-none neon-surface space-y-3 rounded-[1.75rem] border-dashed p-4 text-sm text-muted">
            <p>
              No persisted PR battle reports are attached to this profile snapshot yet. Direct report URLs will appear here after scoring writes score events with public PR evidence.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/settings">Refresh sync settings</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/contributions">Inspect contributions</Link>
              </Button>
            </div>
          </li>
        ) : null}
        {sortedReports.map((report) => (
          <li key={report.contribution.id} className="list-none render-opt-card neon-surface rounded-[1.75rem] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="break-anywhere text-sm text-muted">{report.contribution.owner}/{report.contribution.repo} #{report.contribution.number}</p>
                <h3 className="mt-2 break-anywhere text-lg font-medium text-white">{report.contribution.title}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold">
                    {report.contribution.category}
                  </span>
                  <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
                    Difficulty {report.contribution.difficultyScore}
                  </span>
                  <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
                    {formatContributionStatus(report.contribution.status)}
                  </span>
                  <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
                    Evidence {formatEvidenceState(report.evidenceState.status)}
                  </span>
                </div>
                <ExpandableText
                  text={report.contribution.aiSummary}
                  lines={3}
                  minLengthForToggle={160}
                  className="mt-3 max-w-3xl"
                  textClassName="break-anywhere text-sm leading-6 text-muted"
                />
                <p className="mt-2 text-xs text-muted">
                  Score formula {report.scoreVersion || "not recorded"} · analysis {report.analysisVersion || "not recorded"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-primary">XP earned</p>
                <p className="numeric-readout mt-2 text-3xl font-semibold text-white">
                  {report.contribution.xpEarned.toLocaleString("en-US")}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-100">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
                  {confidenceLabel(report)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/pr/${report.contribution.owner}/${report.contribution.repo}/${report.contribution.number}`} prefetch={false}>
                  View report
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {sortedReports.length > 0 ? (
        <p className="inline-flex items-center gap-2 text-xs text-cyan-100/88">
          <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
          Report cards prioritize merged contribution quality over raw activity volume.
        </p>
      ) : null}
    </GlowCard>
  );
}

function formatContributionStatus(status: PullRequestAnalysis["contribution"]["status"]): string {
  if (status === "merged") {
    return "Merged";
  }
  if (status === "open") {
    return "Open";
  }
  return "Closed";
}

function formatEvidenceState(status: PullRequestAnalysis["evidenceState"]["status"]): string {
  return status.replaceAll("_", " ");
}

function confidenceLabel(report: PullRequestAnalysis): string {
  if (report.evidenceState.deterministicOnly) {
    return "Deterministic scoring mode";
  }
  if (report.evidenceState.aiFallback) {
    return "AI fallback mode";
  }
  if (report.evidenceState.rateLimited) {
    return "Rate-limited evidence mode";
  }
  const confidence = Math.max(0, Math.min(100, Math.round(report.aiConfidence * 100)));
  return `Confidence ${confidence}%`;
}
