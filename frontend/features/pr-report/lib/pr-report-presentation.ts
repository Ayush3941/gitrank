import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";
import type { PullRequestAnalysis } from "@/types/gitrank";

export type PRReportBadgeReward = {
  key: string;
  name: string;
  description?: string;
  rule?: string;
  ruleVersion?: string;
  evidenceSignals: string[];
};

export function buildPRReportPresentation(report: PullRequestAnalysis) {
  return {
    evidenceAnchored: report.evidenceState.status === "complete",
    uniqueBadgeUnlocks: deduplicateBadgeUnlocks(report.badgeUnlocks),
    suggestedQuestSignals: report.suggestedQuest
      ? buildEvidenceSignalChips(report.suggestedQuest.evidenceSignals, 3)
      : [],
    signalTier: buildSignalTier(report.contribution.xpEarned),
  };
}

function deduplicateBadgeUnlocks(badges: PRReportBadgeReward[]) {
  const byName = new Map<string, PRReportBadgeReward>();

  for (const badge of badges) {
    const normalizedName = badge.name.trim().toLowerCase();
    const existing = byName.get(normalizedName);
    if (!existing) {
      byName.set(normalizedName, {
        ...badge,
        evidenceSignals: uniqueStrings(badge.evidenceSignals),
      });
      continue;
    }
    byName.set(normalizedName, {
      ...existing,
      key: existing.key || badge.key,
      name: existing.name || badge.name,
      description: existing.description || badge.description,
      rule: existing.rule || badge.rule,
      ruleVersion: existing.ruleVersion || badge.ruleVersion,
      evidenceSignals: uniqueStrings([...existing.evidenceSignals, ...badge.evidenceSignals]),
    });
  }

  return Array.from(byName.values());
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(value);
  }
  return output;
}

function buildSignalTier(xpEarned: number): "High signal" | "Medium signal" | "Early signal" {
  if (xpEarned >= 250) {
    return "High signal";
  }
  if (xpEarned >= 100) {
    return "Medium signal";
  }
  return "Early signal";
}
