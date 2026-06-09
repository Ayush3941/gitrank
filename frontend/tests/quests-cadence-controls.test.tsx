import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestsCadenceControls } from "@/features/quests/components/QuestsCadenceControls";
import type { QuestCadenceFilter } from "@/features/quests/lib/quests-page-model";

describe("QuestsCadenceControls", () => {
  it("renders mission counts and routes cadence changes", () => {
    const onValueChange = vi.fn<(value: QuestCadenceFilter) => void>();

    render(
      <QuestsCadenceControls
        {...baseProps()}
        totalQuestCount={8}
        cadenceCounts={{
          Daily: 2,
          Weekly: 3,
          "Long-term": 1,
          "Skill-based": 2,
        }}
        value="All"
        displayValue="All"
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Showing all 8 missions");
    expect(screen.getByText("8 missions")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Weekly" }).textContent).toContain("3");

    fireEvent.click(screen.getByRole("radio", { name: "Weekly" }));
    expect(onValueChange).toHaveBeenCalledWith("Weekly");
  });

  it("uses singular mission labels for one filtered cadence result", () => {
    render(
      <QuestsCadenceControls
        {...baseProps()}
        value="Daily"
        displayValue="Daily"
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Showing 1 daily mission");
    expect(screen.getByText("1 daily mission")).toBeTruthy();
  });

  it("renders active filter reset and updating state", () => {
    const onValueChange = vi.fn<(value: QuestCadenceFilter) => void>();

    render(
      <QuestsCadenceControls
        {...baseProps()}
        value="Daily"
        displayValue="Daily"
        isFiltering
        canReset
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Updating missions");
    expect(screen.getByText("Updating missions...")).toBeTruthy();
    expect(screen.getByText("Active: 1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onValueChange).toHaveBeenCalledWith("All");
  });
});

function baseProps() {
  return {
    totalQuestCount: 4,
    cadenceCounts: {
      Daily: 1,
      Weekly: 1,
      "Long-term": 1,
      "Skill-based": 1,
    },
    value: "All" as QuestCadenceFilter,
    displayValue: "All" as QuestCadenceFilter,
    isFiltering: false,
    canReset: false,
    filterStatusId: "quest-filter-status",
    missionsRegionId: "quest-missions",
    onValueChange: vi.fn<(value: QuestCadenceFilter) => void>(),
  };
}
