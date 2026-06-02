import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/shared/EmptyState";

describe("EmptyState", () => {
  it("uses a purposeful decorative absence icon without exposing extra screen-reader copy", () => {
    const { container } = render(
      <EmptyState
        title="No reports yet"
        description="Merged PR reports appear here after sync settles."
      />,
    );

    const icon = container.querySelector(".lucide-inbox");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".lucide-sparkles")).toBeNull();
  });

  it("keeps one clear recovery action for empty lanes", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No filtered reports"
        description="Reset filters to view reports."
        actionLabel="Reset filters"
        onAction={onAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
