import { describe, expect, it } from "vitest";
import { shouldShowHeaderEyebrow } from "@/lib/presentation/header-eyebrow";

describe("shouldShowHeaderEyebrow", () => {
  it("hides repeated eyebrow labels after normalization", () => {
    expect(shouldShowHeaderEyebrow("PR Report", "pr-report")).toBe(false);
  });

  it("keeps distinct eyebrow context visible", () => {
    expect(shouldShowHeaderEyebrow("PR report", "PR battle report")).toBe(true);
  });
});
