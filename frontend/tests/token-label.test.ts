import { describe, expect, it } from "vitest";
import { formatTokenLabel } from "@/lib/presentation/token-label";

describe("formatTokenLabel", () => {
  it("formats machine tokens as readable labels", () => {
    expect(formatTokenLabel("queued_for_backfill")).toBe("Queued for backfill");
    expect(formatTokenLabel("rate-limited_hydration")).toBe("Rate limited hydration");
    expect(formatTokenLabel("  already readable  ")).toBe("Already readable");
    expect(formatTokenLabel("ai_pr_xp")).toBe("AI PR XP");
  });

  it("returns an empty string for blank tokens", () => {
    expect(formatTokenLabel("   ")).toBe("");
  });
});
