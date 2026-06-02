import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScrollableRegion } from "@/components/shared/ScrollableRegion";

describe("ScrollableRegion", () => {
  it("announces operation guidance for focusable scroll areas", () => {
    render(
      <ScrollableRegion label="Sync results">
        <p>Run rows</p>
      </ScrollableRegion>,
    );

    const region = screen.getByRole("region", { name: "Sync results" });
    const descriptionId = region.getAttribute("aria-describedby");

    expect(descriptionId).toBeTruthy();
    expect(screen.getByText(/Scrollable region/i)).toBeTruthy();
  });

  it("preserves caller descriptions when adding scroll guidance", () => {
    render(
      <>
        <p id="summary">Showing five repositories.</p>
        <ScrollableRegion label="Repository rows" aria-describedby="summary">
          <p>Repository cards</p>
        </ScrollableRegion>
      </>,
    );

    const region = screen.getByRole("region", { name: "Repository rows" });
    expect(region.getAttribute("aria-describedby")).toContain("summary");
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
    expect(region.getAttribute("aria-describedby")).toBeNull();
  });
});
