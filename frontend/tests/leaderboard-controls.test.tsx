import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeaderboardControls } from "@/features/leaderboard/components/LeaderboardControls";
import type { LeaderboardTab } from "@/lib/api/leaderboard-api";

describe("LeaderboardControls", () => {
  it("renders lane status and routes lane changes", () => {
    const onTabChange = vi.fn<(value: LeaderboardTab) => void>();

    render(
      <LeaderboardControls
        {...baseProps()}
        rowsCount={14}
        tab="Global"
        onTabChange={onTabChange}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Viewing Global");
    expect(screen.getByText("14 rows")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Backend" }));
    expect(onTabChange).toHaveBeenCalledWith("Backend");
  });

  it("renders active control chips and delegates reset", () => {
    const onReset = vi.fn();

    render(
      <LeaderboardControls
        {...baseProps()}
        tab="Backend"
        activeFilterCount={3}
        hasViewFilter
        showLaneDetails
        canClearAllControls
        onReset={onReset}
      />,
    );

    expect(screen.getByText("Active: 3")).toBeTruthy();
    expect(screen.getByText("Lane: Backend")).toBeTruthy();
    expect(screen.getByText("View: Full board")).toBeTruthy();
    expect(screen.getByText("Details: On")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("delegates view option actions when expanded", () => {
    const onToggleLaneDetails = vi.fn();
    const onToggleNearbyMode = vi.fn();

    render(
      <LeaderboardControls
        {...baseProps()}
        showViewOptions
        supportsNearbyMode
        effectiveMode="nearby"
        onToggleLaneDetails={onToggleLaneDetails}
        onToggleNearbyMode={onToggleNearbyMode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));
    expect(onToggleLaneDetails).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Show full board" }));
    expect(onToggleNearbyMode).toHaveBeenCalledTimes(1);
  });
});

function baseProps() {
  return {
    rowsCount: 0,
    tab: "Global" as LeaderboardTab,
    isBusy: false,
    activeFilterCount: 0,
    hasViewFilter: false,
    showLaneDetails: false,
    canClearAllControls: false,
    rowsRegionId: "leaderboard-rows",
    viewOptionsToggleId: "leaderboard-view-options-toggle",
    viewOptionsRegionId: "leaderboard-view-options",
    showViewOptions: false,
    supportsNearbyMode: false,
    effectiveMode: "full" as const,
    onReset: vi.fn(),
    onTabChange: vi.fn<(value: LeaderboardTab) => void>(),
    onToggleViewOptions: vi.fn(),
    onToggleLaneDetails: vi.fn(),
    onToggleNearbyMode: vi.fn(),
  };
}
