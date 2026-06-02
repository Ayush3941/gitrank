import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DisclosureToggle } from "@/components/shared/DisclosureToggle";

describe("DisclosureToggle", () => {
  it("keeps a readable touch target and toggles the controlled detail panel", () => {
    const onToggle = vi.fn();
    render(
      <DisclosureToggle
        id="report-details-toggle"
        controlsId="report-details"
        expanded={false}
        onToggle={onToggle}
        collapsedLabel="Show details"
        expandedLabel="Hide details"
      />,
    );

    const toggle = screen.getByRole("button", { name: "Show details" });
    expect(toggle.className).toContain("min-h-10");
    expect(toggle.getAttribute("aria-controls")).toBe("report-details");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
