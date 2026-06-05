import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatMonthDay,
  formatMonthDayYear,
  formatNumber,
  formatPluralCount,
  formatRelativeDays,
  formatSignedNumber,
  formatSignedXp,
  formatUtcMonthDay,
  formatXp,
  normalizeDateTime,
} from "@/lib/formatters";

describe("number formatters", () => {
  it("formats plain, signed, and XP numbers consistently", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatXp(4200)).toBe("4,200");
    expect(formatSignedNumber(1200)).toBe("+1,200");
    expect(formatSignedNumber(-1200)).toBe("-1,200");
    expect(formatSignedNumber(0)).toBe("0");
    expect(formatSignedXp(1200.4)).toBe("+1,200 XP");
    expect(formatSignedXp(-1200.4)).toBe("-1,200 XP");
    expect(formatSignedXp(Number.NaN)).toBe("0 XP");
  });

  it("formats plural count labels consistently", () => {
    expect(formatPluralCount(1, "evidence PR")).toBe("1 evidence PR");
    expect(formatPluralCount(2, "evidence PR")).toBe("2 evidence PRs");
    expect(formatPluralCount(1, "repository", "repositories")).toBe("1 repository");
    expect(formatPluralCount(1200, "repository", "repositories")).toBe("1,200 repositories");
    expect(formatPluralCount(Number.NaN, "row")).toBe("0 rows");
  });
});

describe("date label formatters", () => {
  it("formats month-day and month-day-year labels with explicit fallbacks", () => {
    expect(formatMonthDay("2026-05-17T18:05:00.000Z")).toMatch(/May/);
    expect(formatMonthDay("not-a-date")).toBe("Date pending");
    expect(formatMonthDay(undefined, "No date")).toBe("No date");
    expect(formatMonthDayYear("2026-05-17T18:05:00.000Z")).toMatch(/2026/);
    expect(formatMonthDayYear("not-a-date")).toBe("Date pending");
  });

  it("formats UTC month-day labels for backend-derived season windows", () => {
    expect(formatUtcMonthDay(new Date("2026-05-17T23:30:00.000Z"))).toBe("May 17");
    expect(formatUtcMonthDay("not-a-date")).toBe("Date pending");
  });

  it("keeps the legacy short date fallback contract", () => {
    expect(formatDate(undefined)).toBe("Never");
    expect(formatDate("not-a-date")).toBe("Never");
  });
});

describe("formatRelativeDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns minute and hour precision for recent sync timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T18:00:00.000Z"));

    expect(formatRelativeDays("2026-05-17T17:58:00.000Z")).toBe("2m ago");
    expect(formatRelativeDays("2026-05-17T16:00:00.000Z")).toBe("2h ago");
  });

  it("returns day precision for older sync timestamps", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T18:00:00.000Z"));

    expect(formatRelativeDays("2026-05-16T18:00:00.000Z")).toBe("1 day ago");
    expect(formatRelativeDays("2026-05-14T18:00:00.000Z")).toBe("3 days ago");
  });
});

describe("formatDateTime", () => {
  it("returns a human-readable date and time for valid timestamps", () => {
    const result = formatDateTime("2026-05-17T18:05:00.000Z");
    expect(result).toMatch(/May/);
    expect(result).toMatch(/17/);
  });

  it("returns Unknown for invalid values", () => {
    expect(formatDateTime("not-a-date")).toBe("Unknown");
    expect(formatDateTime(undefined)).toBe("Unknown");
  });

  it("uses the requested fallback for invalid values", () => {
    expect(formatDateTime("not-a-date", "time pending")).toBe("time pending");
    expect(formatDateTime(undefined, "")).toBe("");
  });
});

describe("normalizeDateTime", () => {
  it("returns an ISO timestamp for valid date values", () => {
    expect(normalizeDateTime("2026-05-17T18:05:00.000Z")).toBe("2026-05-17T18:05:00.000Z");
  });

  it("returns null for missing or invalid values", () => {
    expect(normalizeDateTime(undefined)).toBeNull();
    expect(normalizeDateTime("not-a-date")).toBeNull();
  });
});
