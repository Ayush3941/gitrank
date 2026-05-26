import type { Contribution } from "@/types/gitrank";

export function deduplicateContributionsByPullRequest(rows: Contribution[]): Contribution[] {
  const byPullRequest = new Map<string, Contribution>();
  for (const row of rows) {
    const key = contributionKey(row);
    const current = byPullRequest.get(key);
    if (!current) {
      byPullRequest.set(key, {
        ...row,
        evidenceSignals: uniqueEvidenceSignals(row.evidenceSignals),
      });
      continue;
    }

    const shouldReplace =
      row.xpEarned > current.xpEarned ||
      (row.xpEarned === current.xpEarned &&
        new Date(row.mergedAt).getTime() > new Date(current.mergedAt).getTime());

    if (!shouldReplace) {
      byPullRequest.set(key, {
        ...current,
        evidenceSignals: uniqueEvidenceSignals([
          ...current.evidenceSignals,
          ...row.evidenceSignals,
        ]),
      });
      continue;
    }

    byPullRequest.set(key, {
      ...row,
      aiSummary: row.aiSummary.trim() ? row.aiSummary : current.aiSummary,
      evidenceSignals: uniqueEvidenceSignals([
        ...current.evidenceSignals,
        ...row.evidenceSignals,
      ]),
    });
  }
  return Array.from(byPullRequest.values());
}

function contributionKey(row: Contribution): string {
  return `${row.owner.toLowerCase()}/${row.repo.toLowerCase()}#${row.number}`;
}

function uniqueEvidenceSignals(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

