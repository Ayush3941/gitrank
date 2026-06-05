import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDateTime,
  formatNumber,
  formatRelativeDays,
  formatSignedNumber,
  formatSignedXp,
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
