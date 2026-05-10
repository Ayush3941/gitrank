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
  const days = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / (1000 * 60 * 60 * 24)),
  );
  if (days === 0) return "Synced today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
