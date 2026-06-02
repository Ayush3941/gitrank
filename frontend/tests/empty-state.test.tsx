import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
