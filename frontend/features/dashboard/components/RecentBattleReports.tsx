import { ArrowRight, ShieldCheck } from "lucide-react";
import { ClampedText } from "@/components/shared/ClampedText";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { Button } from "@/components/ui/button";
import { formatRatioPercent, formatXp } from "@/lib/formatters";
import { formatPRCategoryLabel } from "@/lib/presentation/pr-category-label";
import { buildStableRenderRows } from "@/lib/presentation/render-identity";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { PullRequestAnalysis } from "@/types/gitrank";

export function RecentBattleReports({ reports }: { reports: PullRequestAnalysis[] }) {
  const uniqueReports = deduplicateReportsByPR(reports);
  const sortedReports = [...uniqueReports].sort(
    (left, right) => right.contribution.xpEarned - left.contribution.xpEarned,
  );
  const reportRows = buildStableRenderRows(
    sortedReports,
    (report) =>
      `${report.contribution.owner}/${report.contribution.repo}#${report.contribution.number}:${report.contribution.id}`,
    (report) => report.contribution.id,
  );

  return (
    <GlowCard className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Battle reports</h2>
        <Button asChild size="sm" variant="secondary">
          <IntentPrefetchLink href="/dashboard/contributions">
            View all
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </IntentPrefetchLink>
        </Button>
      </div>
      <ul role="list" className="grid gap-3">
        {sortedReports.length === 0 ? (
          <li className="list-none">
            <CompactEmptyState
              title="Battle reports need PR evidence"
              description="Merged PR reports appear here after sync materializes scored contributions."
              primaryAction={{
                label: "Inspect contributions",
                href: "/dashboard/contributions",
              }}
              secondaryAction={{
                label: "Open sync settings",
                href: "/dashboard/settings",
              }}
            />
          </li>
        ) : null}
        {reportRows.map(({ renderId, item: report }) => {
          const evidencePill = reportEvidencePill(report);
          const nextMove = reportNextMove(report);
          return (
            <li
              key={renderId}
              className="list-none render-opt-card neon-surface rounded-[var(--radius-universal)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="break-anywhere text-sm text-muted">{report.contribution.owner}/{report.contribution.repo} #{report.contribution.number}</p>
                  <h3 className="mt-2 break-anywhere text-lg font-medium text-foreground">{report.contribution.title}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold">
                      {formatPRCategoryLabel(report.contribution.category)}
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
                  {nextMove ? <p className="mt-3 text-xs text-cyan-100">{nextMove}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-primary">XP earned</p>
                  <p className="numeric-readout mt-2 text-3xl font-semibold text-foreground">
                    {formatXp(report.contribution.xpEarned)}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-100">
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" aria-hidden="true" />
                    {confidenceLabel(report)}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button asChild variant="secondary" size="sm">
                  <IntentPrefetchLink href={`/pr/${report.contribution.owner}/${report.contribution.repo}/${report.contribution.number}`}>
                    View report
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </IntentPrefetchLink>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </GlowCard>
  );
}

function reportNextMove(report: PullRequestAnalysis): string | null {
  const state = report.evidenceState.status;
  if (state === "stale" || state === "incomplete") {
    return "Refresh sync in Settings to update report evidence.";
  }
  if (state === "rate_limited") {
    return "Retry after rate-limit cooldown, then reopen this report.";
  }
  return null;
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
    return "Deterministic fallback";
  }
  if (report.evidenceState.rateLimited) {
    return "Rate-limited mode";
  }
  return `Confidence ${formatRatioPercent(report.aiConfidence)}`;
}

function reportEvidencePill(report: PullRequestAnalysis): { label: string; className: string } {
  const state = report.evidenceState;
  if (state.status === "complete") {
    const source = (state.analysisSource ?? "").toLowerCase();
    if (source.includes("gemini") || source.includes("openai") || source.includes("ai") || source.includes("hybrid")) {
      return { label: "AI ready", className: "neon-chip-success" };
    }
    return { label: "Deterministic ready", className: "neon-chip-info" };
  }
  if (state.status === "deterministic_only") {
    return { label: "Deterministic", className: "neon-chip-info" };
  }
  if (state.status === "ai_fallback") {
    return { label: "Deterministic fallback", className: "neon-chip-warning" };
  }
  if (state.status === "rate_limited") {
    return { label: "Rate limited", className: "neon-chip-warning" };
  }
  if (state.status === "stale") {
    return { label: "Pending refresh", className: "neon-chip-muted" };
  }
  return { label: "Evidence partial", className: "neon-chip-muted" };
}
