import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandLogo } from "@/components/shared/BrandLogo";

describe("BrandLogo", () => {
  it("defaults to decorative alt text for logo placements beside visible labels", () => {
    const { container } = render(<BrandLogo />);

    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("supports descriptive alt text for standalone logo placements", () => {
    render(<BrandLogo alt="GitRank app icon" />);

    expect(screen.getByRole("img", { name: "GitRank app icon" })).not.toBeNull();
  });
});
