import { describe, expect, it } from "vitest";
import {
  formatContributionStatusLabel,
  toneForContributionStatus,
} from "@/lib/presentation/contribution-status";

describe("contribution-status presentation", () => {
  it("formats known contribution statuses", () => {
    expect(formatContributionStatusLabel("merged")).toBe("Merged");
    expect(formatContributionStatusLabel("open")).toBe("Open");
    expect(formatContributionStatusLabel("closed")).toBe("Closed");
  });

  it("uses an explicit unavailable label for missing contribution status", () => {
    expect(formatContributionStatusLabel(undefined)).toBe("Status unavailable");
    expect(formatContributionStatusLabel(" ")).toBe("Status unavailable");
  });

  it("keeps known status tones distinct and missing statuses muted", () => {
    expect(toneForContributionStatus("merged")).toBe("success");
    expect(toneForContributionStatus("open")).toBe("info");
    expect(toneForContributionStatus("closed")).toBe("warning");
    expect(toneForContributionStatus(undefined)).toBe("muted");
  });
});
