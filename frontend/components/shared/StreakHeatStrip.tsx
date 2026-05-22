import { Flame } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import type { Contribution } from "@/types/gitrank";

type HeatCell = {
  dateKey: string;
  label: string;
  count: number;
  xp: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export function StreakHeatStrip({
  contributions,
  days = 21,
}: {
  contributions: Contribution[];
  days?: number;
}) {
  const safeDays = clampDays(days);
  const cells = buildHeatCells(contributions, safeDays);
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const bestXp = cells.reduce((best, cell) => Math.max(best, cell.xp), 0);
  const averageXp = activeDays > 0 ? Math.round(cells.reduce((sum, cell) => sum + cell.xp, 0) / activeDays) : 0;

  return (
    <GlowCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-primary">Momentum grid</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Last {safeDays} days</h2>
          <p className="mt-1 text-xs text-muted">
            Streak-friendly activity view with contribution counts and XP context.
          </p>
        </div>
        <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
          <Flame className="h-3.5 w-3.5" />
          {activeDays} active days
        </span>
      </div>

      <ul role="list" className="grid grid-cols-7 gap-1.5 sm:grid-cols-11 md:grid-cols-14 lg:grid-cols-21">
        {cells.map((cell) => (
          <li key={cell.dateKey} className="list-none">
            <div
              className={heatCellClassName(cell.intensity)}
              role="img"
              aria-label={`${cell.label}: ${cell.count} contributions, ${cell.xp} XP`}
              title={`${cell.label}: ${cell.count} contributions • ${cell.xp} XP`}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>Avg XP on active days: {averageXp}</span>
        <span>Best day: {bestXp} XP</span>
        <span>Color + tooltip labels avoid color-only signaling.</span>
      </div>
    </GlowCard>
  );
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) {
    return 21;
  }
  return Math.min(42, Math.max(7, Math.round(value)));
}

function buildHeatCells(contributions: Contribution[], days: number): HeatCell[] {
  const now = new Date();
  const dateBuckets = new Map<string, { count: number; xp: number }>();

  for (const row of contributions) {
    const parsed = new Date(row.mergedAt);
    if (Number.isNaN(parsed.getTime())) {
      continue;
    }
    const key = formatDateKey(parsed);
    const existing = dateBuckets.get(key) ?? { count: 0, xp: 0 };
    existing.count += 1;
    existing.xp += Math.max(0, row.xpEarned);
    dateBuckets.set(key, existing);
  }

  const cells: HeatCell[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - offset);
    const dateKey = formatDateKey(day);
    const bucket = dateBuckets.get(dateKey) ?? { count: 0, xp: 0 };
    cells.push({
      dateKey,
      label: day.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      count: bucket.count,
      xp: bucket.xp,
      intensity: heatIntensity(bucket.count, bucket.xp),
    });
  }
  return cells;
}

function formatDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function heatIntensity(count: number, xp: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || xp <= 0) {
    return 0;
  }
  const weighted = count * 0.9 + xp / 120;
  if (weighted >= 4.6) return 4;
  if (weighted >= 3.2) return 3;
  if (weighted >= 1.8) return 2;
  return 1;
}

function heatCellClassName(intensity: HeatCell["intensity"]): string {
  switch (intensity) {
    case 4:
      return "h-4 w-full rounded-[0.1rem] border border-emerald-300/48 bg-emerald-300/85";
    case 3:
      return "h-4 w-full rounded-[0.1rem] border border-cyan-300/44 bg-cyan-300/74";
    case 2:
      return "h-4 w-full rounded-[0.1rem] border border-primary/40 bg-primary/62";
    case 1:
      return "h-4 w-full rounded-[0.1rem] border border-fuchsia-300/32 bg-fuchsia-300/42";
    default:
      return "h-4 w-full rounded-[0.1rem] border border-primary/16 bg-card/58";
  }
}
