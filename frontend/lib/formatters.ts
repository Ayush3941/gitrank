export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatSignedNumber(value: number) {
  if (value === 0) {
    return "0";
  }
  const prefix = value > 0 ? "+" : "-";
  return `${prefix}${formatNumber(Math.abs(value))}`;
}

export function formatXp(value: number) {
  return formatNumber(Number.isFinite(value) ? Math.round(value) : 0);
}

export function formatXpLabel(value: number) {
  return `${formatXp(value)} XP`;
}

export function formatXpProgressLabel(current: number, target: number) {
  return `${formatXpLabel(current)} toward ${formatXpLabel(target)}`;
}

export function formatPluralCount(value: number, singular: string, plural = `${singular}s`) {
  const count = Number.isFinite(value) ? Math.round(value) : 0;
  return `${formatNumber(count)} ${Math.abs(count) === 1 ? singular : plural}`;
}

export function formatCountOfTotal(
  value: number,
  total: number,
  singular: string,
  plural = `${singular}s`,
) {
  const count = Number.isFinite(value) ? Math.round(value) : 0;
  const totalCount = Number.isFinite(total) ? Math.round(total) : 0;
  const noun = Math.abs(totalCount) === 1 ? singular : plural;
  return `${formatNumber(count)} of ${formatNumber(totalCount)} ${noun}`;
}

export function formatSignedXp(value: number) {
  if (!Number.isFinite(value)) {
    return "0 XP";
  }
  return `${formatSignedNumber(Math.round(value))} XP`;
}

export function toBoundedPercent(value: number, fallback = 0) {
  const resolvedValue = Number.isFinite(value) ? value : fallback;
  const safeValue = Number.isFinite(resolvedValue) ? resolvedValue : 0;
  return Math.max(0, Math.min(100, Math.round(safeValue)));
}

export function toRatioPercent(value: number, fallback = 0) {
  if (!Number.isFinite(value)) {
    return toBoundedPercent(fallback);
  }
  return toBoundedPercent(value * 100, fallback);
}

export function formatPercent(value: number, fallback = "0%") {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return `${formatNumber(toBoundedPercent(value))}%`;
}

export function formatRatioPercent(value: number, fallback = "0%") {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return formatPercent(value * 100, fallback);
}

type DateValue = Date | string | undefined;

function validDate(value: DateValue): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatMonthDay(value: DateValue, fallback = "Date pending") {
  const date = validDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function formatUtcMonthDay(value: DateValue, fallback = "Date pending") {
  const date = validDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatMonthDayYear(value: DateValue, fallback = "Date pending") {
  const date = validDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDate(value?: string) {
  return formatMonthDay(value, "Never");
}

export function formatRelativeDays(value?: string) {
  if (!value) return "Never synced";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Unknown sync time";
  const deltaMs = Date.now() - timestamp;
  if (deltaMs <= 0) return "Just now";
  const minutes = Math.floor(deltaMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function formatDateTime(value?: string, fallback = "Unknown") {
  const date = validDate(value);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function normalizeDateTime(value?: string): string | null {
  const date = validDate(value);
  if (!date) return null;
  return date.toISOString();
}

export function formatTimeUntil(value?: string) {
  if (!value) return "Schedule unavailable";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Schedule unavailable";
  const deltaMs = timestamp - Date.now();
  if (deltaMs <= 0) return "Window ended";
  const minutes = Math.ceil(deltaMs / (1000 * 60));
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.ceil(hours / 24);
  if (days < 30) return `${days}d left`;
  const weeks = Math.ceil(days / 7);
  if (weeks < 10) return `${weeks}w left`;
  const months = Math.ceil(days / 30);
  return `${months}mo left`;
}
