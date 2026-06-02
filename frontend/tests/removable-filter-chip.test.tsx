import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemovableFilterChip } from "@/components/shared/RemovableFilterChip";

describe("RemovableFilterChip", () => {
  it("keeps a readable touch target and invokes the remove action", () => {
    const onRemove = vi.fn();
    render(
      <RemovableFilterChip
        onRemove={onRemove}
        ariaLabel="Remove Search filter"
        ariaControls="filtered-results"
      >
        Search: llvm
      </RemovableFilterChip>,
    );

    const chip = screen.getByRole("button", { name: "Remove Search filter" });
    expect(chip.className).toContain("min-h-10");
    expect(chip.getAttribute("aria-controls")).toBe("filtered-results");
    expect(chip.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(chip);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
