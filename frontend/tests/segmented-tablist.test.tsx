import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
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
    getButton: (name: RegExp) => screen.getByRole("button", { name }),
  };
}

describe("SegmentedTablist", () => {
  it("prevents default mouse-down scrolling behavior while keeping click updates", () => {
    const { updates, getButton } = renderTablist();
    const runningButton = getButton(/Running/i);

    const mouseDownResult = fireEvent.mouseDown(runningButton, { button: 0 });
    expect(mouseDownResult).toBe(false);

    fireEvent.click(runningButton);
    expect(updates.at(-1)).toBe("Running");
  });

  it("supports arrow-key switching between segmented options", () => {
    const { updates, getButton } = renderTablist();
    const allButton = getButton(/All/i);

    allButton.focus();
    fireEvent.keyDown(allButton, { key: "ArrowRight" });

    expect(updates.at(-1)).toBe("Running");
  });
});
