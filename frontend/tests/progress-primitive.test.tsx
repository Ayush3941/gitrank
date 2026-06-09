import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "@/components/ui/progress";

describe("Progress", () => {
  it("forwards accessible-name props to the progressbar root", () => {
    render(<Progress value={42} aria-label="Evidence sync progress" />);

    const progress = screen.getByRole("progressbar", { name: "Evidence sync progress" });
    expect(progress.getAttribute("aria-valuenow")).toBe("42");
  });
});
