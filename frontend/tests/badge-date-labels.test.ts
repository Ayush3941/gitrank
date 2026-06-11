import { describe, expect, it } from "vitest";
import { formatBadgeEarnedLabel } from "@/features/badges/lib/badge-date-labels";

describe("formatBadgeEarnedLabel", () => {
  it("keeps unlocked badge dates readable when earned evidence is missing", () => {
    expect(formatBadgeEarnedLabel("2026-05-25T10:00:00.000Z")).toMatch(/^Earned May 25/);
    expect(formatBadgeEarnedLabel()).toBe("Earned date pending");
    expect(formatBadgeEarnedLabel("not-a-date")).toBe("Earned date pending");
  });
});
