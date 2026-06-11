import { describe, expect, it } from "vitest";
import {
  formatEvidenceStatusLabel,
  formatSyncStateLabel,
} from "@/lib/presentation/status-tone";

describe("status-tone labels", () => {
  it("uses readable fallback copy when sync or evidence status is missing", () => {
    expect(formatSyncStateLabel(undefined)).toBe("Unavailable");
    expect(formatEvidenceStatusLabel(undefined)).toBe("Unavailable");
  });

  it("formats persisted evidence statuses as user-facing labels", () => {
    expect(formatEvidenceStatusLabel("complete")).toBe("Complete");
    expect(formatEvidenceStatusLabel("incomplete")).toBe("Incomplete");
    expect(formatEvidenceStatusLabel("stale")).toBe("Stale");
    expect(formatEvidenceStatusLabel("deterministic_only")).toBe("Deterministic only");
    expect(formatEvidenceStatusLabel("rate_limited")).toBe("Rate limited");
  });
});
