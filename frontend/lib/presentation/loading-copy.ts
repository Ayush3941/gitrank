export function normalizeLoadingTarget(message: string, fallback = "Content"): string {
  const normalized = message
    .trim()
    .replace(/^loading\s+/i, "")
    .replace(/[.\u2026]+$/u, "")
    .trim();
  return normalized || fallback;
}

export function formatLoadingAnnouncement(target: string, detail?: string): string {
  const subject = formatLoadingSubject(target);
  const normalizedDetail = normalizeLoadingDetail(detail);
  return normalizedDetail ? `${subject} ${normalizedDetail}` : subject;
}

function formatLoadingSubject(target: string): string {
  const normalized = normalizeLoadingTarget(target, "content");
  if (startsWithProgressiveVerb(normalized)) {
    return ensureSentence(capitalizeFirstWord(normalized));
  }
  return `Loading ${lowercaseFirstWord(normalized)}.`;
}

function normalizeLoadingDetail(detail?: string): string {
  if (!detail) {
    return "";
  }
  const normalized = normalizeLoadingTarget(detail, "");
  if (!normalized) {
    return "";
  }
  return ensureSentence(capitalizeFirstWord(normalized));
}

function ensureSentence(value: string): string {
  return /[.!?]$/u.test(value) ? value : `${value}.`;
}

function lowercaseFirstWord(value: string): string {
  if (!value) {
    return value;
  }
  const [first = "", ...rest] = value.split(" ");
  if (first.length <= 1 || first.toUpperCase() === first) {
    return value;
  }
  return [first[0]?.toLowerCase() + first.slice(1), ...rest].join(" ");
}

function capitalizeFirstWord(value: string): string {
  if (!value) {
    return value;
  }
  const [first = "", ...rest] = value.split(" ");
  if (first.length <= 1 || first.toUpperCase() === first) {
    return value;
  }
  return [first[0]?.toUpperCase() + first.slice(1), ...rest].join(" ");
}

function startsWithProgressiveVerb(value: string): boolean {
  const [first = ""] = value.trim().split(" ");
  return first.length > 4 && first.toLowerCase().endsWith("ing");
}
