import type { Contribution } from "@/types/gitrank";

type StreakSummary = {
  currentStreakDays: number;
  bestStreakDays: number;
  activeDaysThisYear: number;
  lastActiveDate?: string;
};

type RepositoryTouch = {
  fullName: string;
  contributions: number;
  totalXp: number;
  lastMergedAt: string;
};

export function summarizeContributionStreak(contributions: Contribution[]): StreakSummary {
  const daySet = new Set<string>();
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  let activeDaysThisYear = 0;

  for (const contribution of contributions) {
    const key = toUTCDateKey(contribution.mergedAt);
    if (!key) continue;
    if (!daySet.has(key)) {
      const year = Number.parseInt(key.slice(0, 4), 10);
      if (year === currentYear) {
        activeDaysThisYear += 1;
      }
    }
    daySet.add(key);
  }

  const sorted = [...daySet].sort();
  if (sorted.length === 0) {
    return {
      currentStreakDays: 0,
      bestStreakDays: 0,
      activeDaysThisYear: 0,
    };
  }

  let bestStreak = 1;
  let running = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = new Date(`${sorted[index - 1]}T00:00:00.000Z`);
    const current = new Date(`${sorted[index]}T00:00:00.000Z`);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
    if (diffDays === 1) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 1;
    }
  }

  const latest = sorted[sorted.length - 1];
  let currentStreak = 0;
  let cursor = new Date(`${latest}T00:00:00.000Z`);
  while (daySet.has(toUTCDateKey(cursor.toISOString()))) {
    currentStreak += 1;
    cursor = new Date(cursor.getTime() - 86_400_000);
  }

  const latestDate = new Date(`${latest}T00:00:00.000Z`);
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysSinceLatest = Math.round((todayUtc.getTime() - latestDate.getTime()) / 86_400_000);
  if (daysSinceLatest > 1) {
    currentStreak = 0;
  }

  return {
    currentStreakDays: currentStreak,
    bestStreakDays: bestStreak,
    activeDaysThisYear,
    lastActiveDate: latest,
  };
}

export function summarizeRepositories(
  contributions: Contribution[],
  limit = 6,
): RepositoryTouch[] {
  const map = new Map<string, RepositoryTouch>();

  for (const row of contributions) {
    const key = `${row.owner}/${row.repo}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        fullName: key,
        contributions: 1,
        totalXp: row.xpEarned,
        lastMergedAt: row.mergedAt,
      });
      continue;
    }

    existing.contributions += 1;
    existing.totalXp += row.xpEarned;
    if (Date.parse(row.mergedAt) > Date.parse(existing.lastMergedAt)) {
      existing.lastMergedAt = row.mergedAt;
    }
  }

  return [...map.values()]
    .sort((a, b) => b.totalXp - a.totalXp || b.contributions - a.contributions)
    .slice(0, limit);
}

export function monthTimeline(contributions: Contribution[]): Array<{ month: string; xp: number }> {
  const map = new Map<string, number>();
  for (const row of contributions) {
    const date = new Date(row.mergedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + row.xpEarned);
  }

  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-8)
    .map(([key, xp]) => {
      const [year, month] = key.split("-");
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      return {
        month: new Intl.DateTimeFormat("en-US", {
          month: "short",
          timeZone: "UTC",
        }).format(date),
        xp,
      };
    });
}

export function uniqueContributionDayCount(contributions: Contribution[]): number {
  const daySet = new Set<string>();
  for (const row of contributions) {
    const key = toUTCDateKey(row.mergedAt);
    if (key) daySet.add(key);
  }
  return daySet.size;
}

export function toUTCDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
