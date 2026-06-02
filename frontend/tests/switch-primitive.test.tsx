import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("inherits an accessible name from a paired label", () => {
    render(
      <div>
        <label htmlFor="display-shortcuts">Display shortcuts</label>
        <Switch id="display-shortcuts" />
      </div>,
    );

    const control = screen.getByRole("switch", { name: "Display shortcuts" });
    expect(control.className).toContain("focus-ring");
    expect(control.className).toContain("neon-track");
  });

  it("supports explicit aria labels for compact switch rows", () => {
    render(<Switch aria-label="Toggle repository visibility" />);

    expect(screen.getByRole("switch", { name: "Toggle repository visibility" })).toBeTruthy();
  });
});
