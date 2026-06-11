import { formatDateTime } from "@/lib/formatters";
import { formatPRCategoryLabel } from "@/lib/presentation/pr-category-label";
import { sanitizeReportSummary } from "@/lib/presentation/report-summary";
import type { Contribution } from "@/types/gitrank";

const CONTRIBUTION_CSV_HEADER = [
  "pr_url",
  "owner",
  "repo",
  "number",
  "title",
  "status",
  "category",
  "xp_earned",
  "difficulty_score",
  "impact_score",
  "review_depth_score",
  "test_signal_score",
  "changed_files",
  "merged_at",
  "merged_date_local",
  "maintainer_reviewed",
  "linked_issue",
  "ci_passed",
  "impact_summary",
];

export function buildContributionsCSV(rows: Contribution[]): string {
  const lines = [
    CONTRIBUTION_CSV_HEADER.join(","),
    ...rows.map((row) =>
      [
        `https://github.com/${row.owner}/${row.repo}/pull/${row.number}`,
        row.owner,
        row.repo,
        row.number,
        row.title,
        row.status,
        formatPRCategoryLabel(row.category),
        row.xpEarned,
        row.difficultyScore,
        row.impactScore,
        row.reviewDepthScore,
        row.testSignalScore,
        row.changedFilesCount,
        row.mergedAt,
        formatDateTime(row.mergedAt, ""),
        row.maintainerReviewed,
        row.linkedIssue,
        row.ciPassed,
        sanitizeReportSummary(row.aiSummary),
      ]
        .map(toCSVCell)
        .join(","),
    ),
  ];

  return `\uFEFF${lines.join("\n")}`;
}

export function downloadContributionsCSV(rows: Contribution[]) {
  const csv = buildContributionsCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `gitrank-contributions-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function toCSVCell(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}
