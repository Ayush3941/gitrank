import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExpandableText } from "@/components/shared/ExpandableText";
import { FilterControlsHeader } from "@/components/shared/FilterControlsHeader";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

describe("compact control targets", () => {
  it("keeps expandable text toggles on the shared 40px compact-control baseline", () => {
    render(
      <ExpandableText
        text={"Evidence-backed contributor context. ".repeat(8)}
        minLengthForToggle={20}
      />,
    );

    expect(screen.getByRole("button", { name: "Show more" }).className).toContain("h-10");
  });

  it("keeps filter reset actions on the shared 40px compact-control baseline", () => {
    render(
      <FilterControlsHeader
        label="Filters"
        summary="One active filter"
        resetAction={{ onReset: () => undefined }}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset" }).className).toContain("h-10");
  });

  it("renders plural-aware active-filter count chips", () => {
    const { rerender } = render(
      <FilterControlsHeader
        label="Filters"
        summary="One active filter"
        activeFilterCount={1}
      />,
    );

    expect(screen.getByText("1 active filter")).toBeTruthy();

    rerender(
      <FilterControlsHeader
        label="Filters"
        summary="Two active filters"
        activeFilterCount={2}
      />,
    );

    expect(screen.getByText("2 active filters")).toBeTruthy();
  });

  it("keeps dialog close actions comfortably touchable", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Badge detail</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const close = screen.getByRole("button", { name: "Close dialog" });
    expect(close.className).toContain("h-10");
    expect(close.className).toContain("w-10");
  });
});
