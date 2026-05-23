import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClampedText } from "@/components/shared/ClampedText";
import { GlowCard } from "@/components/shared/GlowCard";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { FeaturedContribution, PullRequestAnalysis } from "@/types/gitrank";

export function BestPRsPanel({
  reports,
  reportDetails = [],
}: {
  reports: FeaturedContribution[];
  reportDetails?: PullRequestAnalysis[];
}) {
  const uniqueReports = deduplicateFeaturedContributionsByPR(reports);
  const detailByPR = new Map<string, PullRequestAnalysis>();
  for (const detail of reportDetails) {
    detailByPR.set(detailKey(detail.contribution.owner, detail.contribution.repo, detail.contribution.number), detail);
  }

  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Best PRs</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Top contributions</h2>
      </div>
      <div className="space-y-3">
        {reports.length === 0 ? (
          <div className="neon-surface rounded-[1.75rem] border-dashed border-primary/24 p-4 text-sm text-muted">
            <p>No public PR reports yet for this profile snapshot.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/" prefetch={false}>Open homepage</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ol role="list" className="space-y-3">
            {uniqueReports.slice(0, 5).map((report, index) => {
              const detail = detailByPR.get(detailKey(report.owner, report.repo, report.number));
              const summary = sanitizeReportSummary(detail?.contribution.aiSummary ?? report.summary);
              const evidencePill = bestPREvidencePill(report, detail);
              return (
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
                  <div className="mt-2">
                    <span className={`neon-chip rounded-full px-3 py-1 text-xs font-semibold ${evidencePill.className}`}>
                      {evidencePill.label}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ClampedText
                      text={summary}
                      lines={2}
                      className="text-sm text-muted"
                    />
                  </div>
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
            );
            })}
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

function detailKey(owner: string, repo: string, number: number): string {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}#${number}`;
}

function bestPREvidencePill(
  report: FeaturedContribution,
  detail?: PullRequestAnalysis,
): { label: string; className: string } {
  if (detail) {
    const state = detail.evidenceState;
    if (state.status === "complete") {
      const source = (state.analysisSource ?? "").toLowerCase();
      if (source.includes("gemini") || source.includes("ai") || source.includes("hybrid")) {
        return { label: "Gemini ready", className: "neon-chip-success" };
      }
      return { label: "Deterministic ready", className: "neon-chip-info" };
    }
    if (state.status === "deterministic_only") {
      return { label: "Deterministic", className: "neon-chip-info" };
    }
    if (state.status === "ai_fallback") {
      return { label: "AI fallback", className: "neon-chip-warning" };
    }
    if (state.status === "rate_limited") {
      return { label: "Rate limited", className: "neon-chip-warning" };
    }
    if (state.status === "stale") {
      return { label: "Pending refresh", className: "neon-chip-muted" };
    }
    return { label: "Evidence partial", className: "neon-chip-muted" };
  }

  if (report.evidenceState === "complete") {
    if (report.analysisId) {
      return { label: "Analysis ready", className: "neon-chip-success" };
    }
    return { label: "Deterministic ready", className: "neon-chip-info" };
  }
  return { label: "Evidence partial", className: "neon-chip-muted" };
}
