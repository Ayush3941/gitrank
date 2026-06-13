import type { Contribution } from "@/types/gitrank";
import { formatCountOfTotal, formatMonthDay, formatPluralCount } from "@/lib/formatters";

export function ContributionPulseStrip({
  contributions,
  days = 14,
  label = "Activity pulse",
}: {
  contributions: Contribution[];
  days?: number;
  label?: string;
}) {
  const cells = buildContributionPulse(contributions, days);
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const todayCell = cells[cells.length - 1] ?? null;
  const hasPulseWindow = cells.length > 0;
  const peakCell = cells.reduce<(typeof cells)[number] | null>(
    (best, cell) => (!best || cell.count >= best.count ? cell : best),
    null,
  );
  const peakSummary = peakCell && peakCell.count > 0
    ? `${peakCell.label}, ${formatContributionCount(peakCell.count)}`
    : hasPulseWindow ? "No active days" : "Window unavailable";
  const activeDaysSummary = hasPulseWindow
    ? formatCountOfTotal(activeDays, cells.length, "active day")
    : "Pulse window unavailable";
  const todaySummary = todayCell
    ? formatContributionCount(todayCell.count)
    : "Today unavailable";

  return (
    <div className="rounded-[var(--radius-universal)] border border-primary/16 bg-primary/6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">{label}</p>
        <p className="text-xs text-muted">
          {activeDaysSummary}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted" role="group" aria-label="Activity pulse summary">
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1">
          <span className="font-semibold text-primary">Today</span>
          {todaySummary}
        </span>
        <span className="neon-chip neon-chip-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1">
          <span className="font-semibold text-primary">Peak</span>
          {peakSummary}
        </span>
      </div>
      <ol
        role="list"
        className={`mt-3 grid gap-1.5 ${days <= 7 ? "grid-cols-7" : "grid-cols-7 sm:grid-cols-14"}`}
      >
        {cells.map((cell) => (
          <li key={cell.key} className="list-none">
            <span
              className={`block h-4 w-full rounded-[var(--radius-universal)] border ${intensityClasses(cell.count)} ${
                cell.isToday ? "ring-1 ring-primary/32 ring-offset-1 ring-offset-background" : ""
              }`}
              aria-hidden="true"
            />
            <span className="sr-only">{`${cell.label}: ${formatContributionCount(cell.count)}`}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function buildContributionPulse(contributions: Contribution[], days: number) {
  const now = new Date();
  const today = startOfDay(now);
  const dayMillis = 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();

  for (const row of contributions) {
    const timestamp = Date.parse(row.mergedAt);
    if (Number.isNaN(timestamp)) {
      continue;
    }
    const day = startOfDay(new Date(timestamp));
    const key = day.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: Array<{
    key: string;
    label: string;
    count: number;
    isToday: boolean;
  }> = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * dayMillis);
    const key = day.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    cells.push({
      key,
      label: formatMonthDay(day),
      count,
      isToday: offset === 0,
    });
  }

  return cells;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatContributionCount(count: number): string {
  return formatPluralCount(count, "contribution");
}

function intensityClasses(count: number): string {
  if (count >= 4) {
    return "border-cyan-300/65 bg-cyan-300/58";
  }
  if (count === 3) {
    return "border-cyan-300/52 bg-cyan-300/46";
  }
  if (count === 2) {
    return "border-cyan-300/42 bg-cyan-300/34";
  }
  if (count === 1) {
    return "border-cyan-300/32 bg-cyan-300/22";
  }
  return "border-primary/18 bg-primary/10";
}
