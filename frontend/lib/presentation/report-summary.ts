const SUMMARY_PREFIX = "summary=[";

export function sanitizeReportSummary(input: string): string {
  let value = input.trim();
  if (!value) {
    return "Deterministic contribution summary is pending.";
  }

  if (value.toLowerCase().startsWith(SUMMARY_PREFIX)) {
    const closing = value.lastIndexOf("]");
    value = closing > SUMMARY_PREFIX.length
      ? value.slice(SUMMARY_PREFIX.length, closing)
      : value.slice(SUMMARY_PREFIX.length);
  }

  value = value
    .replace(/\bscore version\s+[a-z0-9._-]+\b/gi, "Deterministic scoring replay")
    .replace(/\bfinal xp\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!value) {
    return "Deterministic scoring replay metadata is available for this PR.";
  }

  const sentence = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
