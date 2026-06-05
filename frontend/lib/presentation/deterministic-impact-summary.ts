import type { Contribution } from "@/types/gitrank";
import { formatPluralCount } from "@/lib/formatters";

type ContributionSummaryInput = Pick<
  Contribution,
  | "category"
  | "status"
  | "changedFilesCount"
  | "xpEarned"
  | "impactScore"
  | "reviewDepthScore"
  | "testSignalScore"
  | "maintainerReviewed"
  | "linkedIssue"
  | "ciPassed"
>;

const FALLBACK_MARKERS = [
  "analysis pending",
  "deterministic contribution summary is pending",
  "missing analysis",
  "unknown source",
  "report snapshot is stale",
  "report snapshot is pending refresh",
  "analysis has not been persisted",
  "analysis is pending",
];

export function shouldUseDeterministicImpactSummary(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return FALLBACK_MARKERS.some((marker) => normalized.includes(marker));
}

export function buildDeterministicImpactSummary(
  input: ContributionSummaryInput,
): string {
  const categoryPhrase = describeCategory(input.category);
  const scopePhrase =
    input.changedFilesCount <= 1
      ? "a focused file scope"
      : formatPluralCount(input.changedFilesCount, "file");
  const impactTier =
    input.xpEarned >= 250 || input.impactScore >= 70
      ? "high-signal impact"
      : input.xpEarned >= 100 || input.impactScore >= 45
        ? "meaningful impact"
        : "early impact";

  const evidenceSignals: string[] = [];
  if (input.maintainerReviewed || input.reviewDepthScore >= 60) {
    evidenceSignals.push("strong review evidence");
  }
  if (input.testSignalScore >= 45) {
    evidenceSignals.push("clear regression-test signal");
  }
  if (input.ciPassed) {
    evidenceSignals.push("passing CI context");
  }
  if (input.linkedIssue) {
    evidenceSignals.push("linked issue context");
  }

  const qualityPhrase =
    evidenceSignals.length > 0
      ? `with ${joinSignals(evidenceSignals)}`
      : "with limited supporting evidence";

  const nextMove =
    input.testSignalScore < 35
      ? "Add regression tests to raise confidence."
      : input.reviewDepthScore < 40
        ? "Seek maintainer review to strengthen trust signals."
        : !input.ciPassed
          ? "Capture CI signal to improve reliability evidence."
          : "Keep landing similar evidence-backed work for consistency gains.";

  const statusLabel = input.status === "merged" ? "Merged PR" : "PR";

  return `${statusLabel} ${categoryPhrase} across ${scopePhrase} delivered ${impactTier} ${qualityPhrase}. ${nextMove}`;
}

function joinSignals(values: string[]): string {
  if (values.length === 1) {
    return values[0];
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function describeCategory(category: Contribution["category"]): string {
  switch (category) {
    case "Documentation":
      return "documentation improvements";
    case "Testing":
      return "testing coverage improvements";
    case "Bug Fix":
      return "bug-fix work";
    case "Backend":
      return "backend service work";
    case "Infrastructure":
      return "infrastructure maintenance";
    case "Security":
      return "security hardening";
    case "Performance":
      return "performance improvements";
    case "Architecture":
      return "architecture-level changes";
    case "Review":
      return "review-quality contributions";
    default:
      return "contribution work";
  }
}
