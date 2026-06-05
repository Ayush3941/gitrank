export function formatXp(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

export function formatDate(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
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

export function formatDateTime(value?: string) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function normalizeDateTime(value?: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
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
