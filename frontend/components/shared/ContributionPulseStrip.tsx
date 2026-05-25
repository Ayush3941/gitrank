import type { Contribution } from "@/types/gitrank";

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

  return (
    <div className="rounded-[1.75rem] border border-primary/16 bg-primary/6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">{label}</p>
        <p className="text-xs text-muted">
          {activeDays}/{days} active days
        </p>
      </div>
      <ol
        role="list"
        className={`mt-3 grid gap-1.5 ${days <= 7 ? "grid-cols-7" : "grid-cols-7 sm:grid-cols-14"}`}
      >
        {cells.map((cell) => (
          <li key={cell.key} className="list-none">
            <span
              className={`block h-4 w-full rounded-[0.1rem] border ${intensityClasses(cell.count)} ${
                cell.isToday ? "ring-1 ring-primary/32 ring-offset-1 ring-offset-background" : ""
              }`}
              title={`${cell.label}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`}
              aria-label={`${cell.label}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`}
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">
        Each tile represents one day of evidence-backed contribution activity.
      </p>
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
      label: day.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
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
