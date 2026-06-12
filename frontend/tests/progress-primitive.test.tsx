import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "@/components/ui/progress";

describe("Progress", () => {
  it("forwards accessible-name props to the progressbar root", () => {
    render(<Progress value={42} aria-label="Evidence sync progress" />);

    const progress = screen.getByRole("progressbar", { name: "Evidence sync progress" });
    expect(progress.getAttribute("aria-valuenow")).toBe("42");
    expect(progress.getAttribute("aria-valuetext")).toBe("42% complete");
  });

  it("preserves explicit progress value text from feature callers", () => {
    render(
      <Progress
        value={63}
        aria-label="Contribution signal"
        aria-valuetext="Rising signal, 63 of 100"
      />,
    );

    const progress = screen.getByRole("progressbar", { name: "Contribution signal" });
    expect(progress.getAttribute("aria-valuetext")).toBe("Rising signal, 63 of 100");
  });

  it("bounds invalid progress values before generating default value text", () => {
    render(<Progress value={Number.NaN} aria-label="Invalid progress example" />);

    const progress = screen.getByRole("progressbar", { name: "Invalid progress example" });
    expect(progress.getAttribute("aria-valuenow")).toBe("0");
    expect(progress.getAttribute("aria-valuetext")).toBe("0% complete");
  });
});
