import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeaderMetaChips } from "@/components/shared/HeaderMetaChips";

describe("HeaderMetaChips", () => {
  it("renders summary chips inside a labeled focusable scroll region", () => {
    render(
      <HeaderMetaChips
        items={[
          { label: "Rank Gold III", tone: "success" },
          { label: "Merged PRs 12" },
        ]}
      />,
    );

    const region = screen.getByRole("region", { name: "Page summary metrics" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(screen.getByText("Rank Gold III")).not.toBeNull();
    expect(screen.getByText("Merged PRs 12")).not.toBeNull();
  });

  it("supports a route-specific accessibility label", () => {
    render(
      <HeaderMetaChips
        accessibilityLabel="Leaderboard snapshot metrics"
        items={[{ label: "Lane Global" }]}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Leaderboard snapshot metrics" }),
    ).not.toBeNull();
  });

  it("accepts stable IDs for repeated visible chip labels", () => {
    render(
      <HeaderMetaChips
        items={[
          { id: "rank-before", label: "Rank Bronze I" },
          { id: "rank-after", label: "Rank Bronze I" },
        ]}
      />,
    );

    expect(screen.getAllByText("Rank Bronze I")).toHaveLength(2);
  });

  it("does not render an empty summary region", () => {
    const { container } = render(<HeaderMetaChips items={[]} />);

    expect(container.firstChild).toBeNull();
  });
});
