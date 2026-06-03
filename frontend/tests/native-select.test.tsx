import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NativeSelect } from "@/components/ui/select";

describe("NativeSelect", () => {
  it("renders a named combobox with the shared surface treatment", () => {
    render(
      <label>
        Run status
        <NativeSelect defaultValue="completed">
          <option value="all">All</option>
          <option value="completed">Completed</option>
        </NativeSelect>
      </label>,
    );

    const select = screen.getByRole("combobox", { name: "Run status" });
    expect(select.className).toContain("neon-surface");
    expect(select.className).toContain("appearance-none");
    expect(select.className).toContain("rounded-[var(--radius-universal)]");
  });

  it("keeps the visual chevron decorative", () => {
    const rendered = render(
      <NativeSelect aria-label="Run status" defaultValue="all">
        <option value="all">All</option>
      </NativeSelect>,
    );

    const icon = rendered.container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("focusable")).toBe("false");
  });
});
