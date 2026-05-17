import { describe, expect, it } from "vitest";
import { initialSectionFromHash } from "@/lib/section-nav";

describe("initialSectionFromHash", () => {
  it("returns the matching section id from the hash", () => {
    expect(
      initialSectionFromHash(
        ["dashboard-hero", "dashboard-snapshot", "dashboard-league"],
        "dashboard-hero",
        "#dashboard-league",
      ),
    ).toBe("dashboard-league");
  });

  it("supports encoded hashes", () => {
    expect(
      initialSectionFromHash(
        ["pr-report-overview", "signals/v2"],
        "pr-report-overview",
        "#signals%2Fv2",
      ),
    ).toBe("signals/v2");
  });

  it("falls back when hash does not match", () => {
    expect(
      initialSectionFromHash(["settings-account", "settings-data-controls"], "settings-account", "#missing"),
    ).toBe("settings-account");
  });

  it("falls back when hash encoding is invalid", () => {
    expect(
      initialSectionFromHash(["settings-account", "settings-data-controls"], "settings-account", "#bad%ZZ"),
    ).toBe("settings-account");
  });
});
