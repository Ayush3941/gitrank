import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollableRegion } from "@/components/shared/ScrollableRegion";

describe("ScrollableRegion", () => {
  it("renders a labeled focusable region by default", () => {
    render(
      <ScrollableRegion label="Recent sync runs" className="overflow-y-auto">
        <div>content</div>
      </ScrollableRegion>,
    );

    const region = screen.getByRole("region", { name: "Recent sync runs" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("focus-ring");
  });

  it("supports aria-labelledby and optional non-focusable mode", () => {
    render(
      <>
        <h2 id="repository-controls">Repository controls</h2>
        <ScrollableRegion labelledById="repository-controls" focusable={false}>
          <div>content</div>
        </ScrollableRegion>
      </>,
    );

    const region = screen.getByRole("region", { name: "Repository controls" });
    expect(region.getAttribute("tabindex")).toBeNull();
    expect(region.className).not.toContain("focus-ring");
  });
});
