import { formatXpLabel } from "@/lib/formatters";

const SUMMARY_PREFIX = "summary=[";

export function buildEvidenceSignalChips(
  signals: readonly string[],
  maxItems = Number.POSITIVE_INFINITY,
): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const signal of signals) {
    const formatted = formatEvidenceSignal(signal);
    if (!formatted) {
      continue;
    }
    const key = normalizeKey(formatted);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(formatted);
    if (output.length >= maxItems) {
      break;
    }
  }

  return output;
}

export function formatEvidenceSignal(signal: string): string | null {
  const value = signal.trim();
  if (!value) {
    return null;
  }
  const lower = value.toLowerCase();

  if (lower.startsWith("fallback_reason=")) {
    const reason = value.slice("fallback_reason=".length).trim();
    if (!reason) {
      return "AI fallback";
    }
    return `AI fallback: ${humanizeToken(reason)}`;
  }

  if (lower.startsWith("score_version=")) {
    const version = value.slice("score_version=".length).trim();
    return version ? `Formula ${version}` : "Formula";
  }

  {
    const match = /^score version\s+([a-z0-9._-]+)/i.exec(value);
    if (match) {
      return `Formula ${match[1]}`;
    }
  }

  if (lower.startsWith("category=")) {
    return formatCategoryChip(value.slice("category=".length));
  }
  {
    const match = /^category\s+([a-z0-9._-]+)/i.exec(value);
    if (match) {
      return formatCategoryChip(match[1]);
    }
  }

  if (lower.startsWith("files=")) {
    const count = parsePositiveInteger(value.slice("files=".length));
    return count == null ? "Files changed" : `${count} files changed`;
  }
  {
    const match = /^(\d+)\s+changed files persisted$/i.exec(value);
    if (match) {
      return `${match[1]} files changed`;
    }
  }

  if (lower.startsWith("source_files=")) {
    const count = parsePositiveInteger(value.slice("source_files=".length));
    return count == null ? "Source files" : `${count} source files`;
  }

  if (lower.startsWith("commits=")) {
    const count = parsePositiveInteger(value.slice("commits=".length));
    return count == null ? "Commits" : `${count} commits`;
  }

  if (lower.startsWith("languages=")) {
    const languages = value
      .slice("languages=".length)
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!languages.length) {
      return null;
    }
    if (languages.length === 1) {
      return `Language ${languages[0]}`;
    }
    return `Languages ${languages.join(", ")}`;
  }

  if (lower.startsWith("linked_issues=")) {
    const count = parsePositiveInteger(value.slice("linked_issues=".length));
    if (count == null) {
      return "Linked issues";
    }
    return `${count} linked ${count === 1 ? "issue" : "issues"}`;
  }

  if (lower.startsWith("criticality=")) {
    const criticality = value.slice("criticality=".length).trim();
    if (!criticality) {
      return null;
    }
    return criticalityLabel(criticality);
  }

  if (lower.startsWith("rule_version=")) {
    const version = value.slice("rule_version=".length).trim();
    return version ? `Rule ${version}` : "Rule";
  }

  if (lower.startsWith("rule=")) {
    const rule = value.slice("rule=".length).trim();
    return rule ? `Trigger ${humanizeToken(rule)}` : "Trigger";
  }

  if (lower.startsWith("active_weeks=")) {
    const count = parsePositiveInteger(value.slice("active_weeks=".length));
    return count == null ? "Active weeks" : `${count} active weeks`;
  }

  if (lower.startsWith("repository_count=")) {
    const count = parsePositiveInteger(value.slice("repository_count=".length));
    return count == null ? "Repo coverage" : `${count} repos touched`;
  }

  if (lower.startsWith("testing_xp=")) {
    const xp = parsePositiveInteger(value.slice("testing_xp=".length));
    return xp == null ? "Testing XP" : `Testing ${formatXpLabel(xp)}`;
  }

  if (lower.startsWith("contribution_span=")) {
    const span = parsePositiveInteger(value.slice("contribution_span=".length));
    return span == null ? "Contribution span" : `${span} day contribution span`;
  }

  if (lower.startsWith(SUMMARY_PREFIX)) {
    return "Deterministic scoring replay";
  }

  if (lower.includes("analysis has not been persisted") || lower.includes("missing analysis")) {
    return "Analysis pending";
  }

  if (lower.includes("report snapshot is stale") || lower.includes("stale until analysis")) {
    return "Report refresh pending";
  }

  if (lower.includes("rate limited") || lower.includes("rate_limit")) {
    return "Rate limited";
  }

  if (lower === "first accepted scored contribution") {
    return "First accepted scored contribution";
  }

  return truncateChip(value);
}

function parsePositiveInteger(raw: string): number | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function formatCategoryChip(raw: string): string {
  const category = raw.trim();
  if (!category) {
    return "Category";
  }
  return `Category ${humanizeToken(category)}`;
}

function criticalityLabel(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  switch (normalized) {
    case "api_surface":
      return "API surface touched";
    case "runtime_path":
      return "Runtime path touched";
    case "infra_path":
      return "Infrastructure path touched";
    case "security_sensitive":
      return "Security-sensitive path";
    default:
      return `Criticality ${humanizeToken(raw)}`;
  }
}

function humanizeToken(value: string): string {
  const cleaned = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return "";
  }
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function truncateChip(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= 64) {
    return compact;
  }
  return `${compact.slice(0, 61).trimEnd()}...`;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
