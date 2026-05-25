import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTablist } from "@/components/shared/SegmentedTablist";

function TablistHarness({
  onUpdate,
}: {
  onUpdate: (value: "All" | "Running") => void;
}) {
  const [value, setValue] = useState<"All" | "Running">("All");

  return (
    <SegmentedTablist
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

function renderTablist() {
  const updates: Array<"All" | "Running"> = [];
  render(<TablistHarness onUpdate={(value) => updates.push(value)} />);
  return {
    updates,
    getTab: (name: RegExp) => screen.getByRole("tab", { name }),
  };
}

describe("SegmentedTablist", () => {
  it("keeps pointer interactions selection-only and does not pre-focus on pointer down", () => {
    const { updates, getTab } = renderTablist();
    const runningButton = getTab(/Running/i);

    const pointerDownResult = fireEvent.pointerDown(runningButton, { button: 0, pointerType: "touch" });
    expect(pointerDownResult).toBe(true);
    expect(document.activeElement).not.toBe(runningButton);

    fireEvent.click(runningButton);
    expect(updates.at(-1)).toBe("Running");
  });

  it("keeps mouse-down interactions selection-only and does not force focus", () => {
    const { updates, getTab } = renderTablist();
    const runningButton = getTab(/Running/i);

    const mouseDownResult = fireEvent.mouseDown(runningButton, { button: 0 });
    expect(mouseDownResult).toBe(true);
    expect(document.activeElement).not.toBe(runningButton);

    fireEvent.click(runningButton);
    expect(updates.at(-1)).toBe("Running");
  });

  it("uses manual keyboard activation for arrow navigation", () => {
    const { updates, getTab } = renderTablist();
    const allButton = getTab(/All/i);
    const runningButton = getTab(/Running/i);

    allButton.focus();
    fireEvent.keyDown(allButton, { key: "ArrowRight" });

    expect(updates).toHaveLength(0);
    expect(document.activeElement).toBe(runningButton);

    fireEvent.keyDown(runningButton, { key: "Enter" });
    expect(updates.at(-1)).toBe("Running");
  });

  it("does not force viewport scroll restoration when selecting a tab", () => {
    const scrollSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const { getTab } = renderTablist();
    fireEvent.click(getTab(/Running/i));

    expect(scrollSpy).not.toHaveBeenCalled();
    scrollSpy.mockRestore();
  });
});
