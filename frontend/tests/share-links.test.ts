import { describe, expect, it } from "vitest";
import { toAbsoluteShareUrl } from "@/lib/share-links";

describe("toAbsoluteShareUrl", () => {
  it("converts relative app paths into absolute URLs when origin is present", () => {
    expect(toAbsoluteShareUrl("/dashboard#overview", "http://localhost:3000")).toBe(
      "http://localhost:3000/dashboard#overview",
    );
  });

  it("preserves query and hash context when composing absolute URLs", () => {
    expect(
      toAbsoluteShareUrl("/dashboard/leaderboard?lane=global#leaderboard-arena", "http://localhost:3000"),
    ).toBe("http://localhost:3000/dashboard/leaderboard?lane=global#leaderboard-arena");
  });

  it("keeps absolute URLs unchanged", () => {
    expect(
      toAbsoluteShareUrl("https://gitrank.dev/u/example#public-profile-overview", "http://localhost:3000"),
    ).toBe("https://gitrank.dev/u/example#public-profile-overview");
  });

  it("normalizes non-slash paths when no origin is provided", () => {
    expect(toAbsoluteShareUrl("dashboard/settings#settings-account")).toBe(
      "/dashboard/settings#settings-account",
    );
  });
});
