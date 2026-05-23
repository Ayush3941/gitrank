import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ClampedText } from "@/components/shared/ClampedText";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function RecentBattleReports({ reports }: { reports: PullRequestAnalysis[] }) {
  const uniqueReports = deduplicateReportsByPR(reports);
  const sortedReports = [...uniqueReports].sort(
    (left, right) => right.contribution.xpEarned - left.contribution.xpEarned,
  );

  return (
    <GlowCard className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Battle reports</h2>
        <Button asChild size="sm" variant="secondary">
          <Link href="/dashboard/contributions" prefetch={false}>
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <ul role="list" className="grid gap-3">
        {sortedReports.length === 0 ? (
          <li className="list-none neon-surface space-y-3 rounded-[1.75rem] border-dashed p-4 text-sm text-muted">
            <p>No reports yet. They appear after sync + scoring.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link href="/dashboard/contributions" prefetch={false}>Inspect contributions</Link>
              </Button>
            </div>
          </li>
        ) : null}
        {sortedReports.map((report, index) => {
          const evidencePill = reportEvidencePill(report);
          return (
            <li
              key={`${report.contribution.owner}/${report.contribution.repo}#${report.contribution.number}-${report.contribution.id}-${index}`}
              className="list-none render-opt-card neon-surface rounded-[1.75rem] p-4"
            >
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
                    <span className={`neon-chip rounded-full px-3 py-1 text-xs font-semibold ${evidencePill.className}`}>
                      {evidencePill.label}
                    </span>
                  </div>
                  <div className="mt-3 max-w-3xl">
                    <ClampedText
                      text={sanitizeReportSummary(report.contribution.aiSummary)}
                      lines={2}
                      className="text-sm leading-6 text-muted"
                    />
                  </div>
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
          );
        })}
      </ul>
    </GlowCard>
  );
}

function deduplicateReportsByPR(reports: PullRequestAnalysis[]): PullRequestAnalysis[] {
  const bestByPR = new Map<string, PullRequestAnalysis>();

  for (const report of reports) {
    const key = `${report.contribution.owner}/${report.contribution.repo}#${report.contribution.number}`;
    const existing = bestByPR.get(key);
    if (!existing || report.contribution.xpEarned > existing.contribution.xpEarned) {
      bestByPR.set(key, report);
    }
  }

  return Array.from(bestByPR.values());
}

function confidenceLabel(report: PullRequestAnalysis): string {
  if (report.evidenceState.deterministicOnly) {
    return "Deterministic mode";
  }
  if (report.evidenceState.aiFallback) {
    return "AI fallback mode";
  }
  if (report.evidenceState.rateLimited) {
    return "Rate-limited mode";
  }
  const confidence = Math.max(0, Math.min(100, Math.round(report.aiConfidence * 100)));
  return `Confidence ${confidence}%`;
}

function reportEvidencePill(report: PullRequestAnalysis): { label: string; className: string } {
  const state = report.evidenceState;
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
