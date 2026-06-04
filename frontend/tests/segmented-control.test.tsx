import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "@/components/shared/SegmentedControl";

function SegmentedControlHarness({
  onUpdate,
}: {
  onUpdate: (value: "All" | "Running") => void;
}) {
  const [value, setValue] = useState<"All" | "Running">("All");

  return (
    <SegmentedControl
      options={[
        { value: "All", label: "All", count: 2 },
        { value: "Running", label: "Running", count: 1 },
      ]}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onUpdate(next);
      }}
      ariaLabel="Sync status filters"
    />
  );
}

function renderSegmentedControl() {
  const updates: Array<"All" | "Running"> = [];
  render(<SegmentedControlHarness onUpdate={(value) => updates.push(value)} />);
  return {
    updates,
    getRadio: (name: RegExp) => screen.getByRole("radio", { name }),
  };
}

describe("SegmentedControl", () => {
  it("uses radio semantics for single-choice filter controls", () => {
    const { getRadio } = renderSegmentedControl();

    expect(screen.getByRole("radiogroup", { name: "Sync status filters" })).toBeTruthy();
    expect(getRadio(/All/i).getAttribute("aria-checked")).toBe("true");
    expect(getRadio(/Running/i).getAttribute("aria-checked")).toBe("false");
  });

  it("keeps pointer interactions selection-only and does not pre-focus on pointer down", () => {
    const { updates, getRadio } = renderSegmentedControl();
    const runningButton = getRadio(/Running/i);

    const pointerDownResult = fireEvent.pointerDown(runningButton, { button: 0, pointerType: "touch" });
    expect(pointerDownResult).toBe(true);
    expect(document.activeElement).not.toBe(runningButton);

    fireEvent.click(runningButton);
    expect(updates.at(-1)).toBe("Running");
  });

  it("keeps mouse-down interactions selection-only and does not force focus", () => {
    const { updates, getRadio } = renderSegmentedControl();
    const runningButton = getRadio(/Running/i);

    const mouseDownResult = fireEvent.mouseDown(runningButton, { button: 0 });
    expect(mouseDownResult).toBe(true);
    expect(document.activeElement).not.toBe(runningButton);

    fireEvent.click(runningButton);
    expect(updates.at(-1)).toBe("Running");
  });

  it("uses radio keyboard semantics for arrow navigation", () => {
    const { updates, getRadio } = renderSegmentedControl();
    const allButton = getRadio(/All/i);
    const runningButton = getRadio(/Running/i);

    allButton.focus();
    fireEvent.keyDown(allButton, { key: "ArrowRight" });

    expect(updates.at(-1)).toBe("Running");
    expect(document.activeElement).toBe(runningButton);
    expect(runningButton.getAttribute("aria-checked")).toBe("true");
  });

  it("does not force viewport scroll restoration when selecting a control option", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const { getRadio } = renderSegmentedControl();
    fireEvent.click(getRadio(/Running/i));

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });

  it("uses full labels for accessibility when compact labels are rendered", () => {
    const onUpdate = vi.fn();
    render(
      <SegmentedControl
        options={[
          { value: "Performance", label: "Performance", compactLabel: "Perf" },
          { value: "Security", label: "Security", compactLabel: "Sec" },
        ]}
        value={"Performance"}
        onValueChange={onUpdate}
        ariaLabel="Contribution focus filters"
      />,
    );

    expect(screen.getByRole("radio", { name: "Performance" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Security" })).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /^Perf$/ })).toBeNull();
    expect(screen.queryByRole("radio", { name: /^Sec$/ })).toBeNull();
  });
});
