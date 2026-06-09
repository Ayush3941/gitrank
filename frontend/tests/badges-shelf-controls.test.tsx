import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BadgesShelfControls } from "@/features/badges/components/BadgesShelfControls";
import type {
  BadgeRarityFilter,
  BadgeVisibilityFilter,
} from "@/features/badges/lib/badge-shelf-model";

describe("BadgesShelfControls", () => {
  it("renders counts and routes visibility filter changes", () => {
    const onVisibilityChange = vi.fn<(value: BadgeVisibilityFilter) => void>();

    render(
      <BadgesShelfControls
        {...baseProps()}
        filteredCount={5}
        totalCount={9}
        unlockedCount={4}
        visibility="All"
        onVisibilityChange={onVisibilityChange}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Showing 5 of 9 badges");
    expect(screen.getByText("5 of 9 badges")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Locked" }));
    expect(onVisibilityChange).toHaveBeenCalledWith("Locked");
  });

  it("renders singular count summaries when only one badge is available", () => {
    render(
      <BadgesShelfControls
        {...baseProps()}
        filteredCount={1}
        totalCount={1}
        unlockedCount={1}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Showing 1 of 1 badge");
    expect(screen.getByText("1 of 1 badge")).toBeTruthy();
  });

  it("uses concise pending copy while badge filters update", () => {
    render(
      <BadgesShelfControls
        {...baseProps()}
        isFiltering
      />,
    );

    expect(screen.getByRole("status").textContent).toBe("Updating badge shelf");
    expect(screen.getByText("Updating shelf")).toBeTruthy();
    expect(screen.queryByText("Updating shelf...")).toBeNull();
  });

  it("toggles advanced rarity controls and routes reset", () => {
    const onToggleAdvancedFilters = vi.fn();
    const onResetFilters = vi.fn();
    const onRarityChange = vi.fn<(value: BadgeRarityFilter) => void>();

    const { rerender } = render(
      <BadgesShelfControls
        {...baseProps()}
        rarity="Rare"
        activeFilterCount={2}
        canResetFilters
        showAdvancedFilters={false}
        onToggleAdvancedFilters={onToggleAdvancedFilters}
        onResetFilters={onResetFilters}
        onRarityChange={onRarityChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Advanced filters" }));
    expect(onToggleAdvancedFilters).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);

    rerender(
      <BadgesShelfControls
        {...baseProps()}
        rarity="Rare"
        activeFilterCount={2}
        canResetFilters
        showAdvancedFilters
        onToggleAdvancedFilters={onToggleAdvancedFilters}
        onResetFilters={onResetFilters}
        onRarityChange={onRarityChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Epic" }));
    expect(onRarityChange).toHaveBeenCalledWith("Epic");
  });
});

function baseProps() {
  return {
    filteredCount: 3,
    totalCount: 6,
    unlockedCount: 2,
    isFiltering: false,
    activeFilterCount: 0,
    canResetFilters: false,
    filterStatusId: "badge-filter-status",
    earnedRegionId: "badge-shelf",
    advancedFiltersToggleId: "badge-advanced-toggle",
    advancedFiltersRegionId: "badge-advanced-region",
    visibility: "All" as BadgeVisibilityFilter,
    rarity: "All" as BadgeRarityFilter,
    showAdvancedFilters: false,
    onVisibilityChange: vi.fn<(value: BadgeVisibilityFilter) => void>(),
    onRarityChange: vi.fn<(value: BadgeRarityFilter) => void>(),
    onResetFilters: vi.fn(),
    onToggleAdvancedFilters: vi.fn(),
  };
}
