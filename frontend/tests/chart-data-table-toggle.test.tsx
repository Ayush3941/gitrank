import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import { TimelineChart } from "@/components/shared/TimelineChart";

vi.mock("@/hooks/use-gamification-preference", () => ({
  useNetworkConstraintPreference: () => true,
  useReducedGamification: () => false,
}));

vi.mock("@/hooks/use-lazy-in-view", () => ({
  useLazyInView: () => ({
    ref: () => {},
    inView: true,
  }),
}));

describe("chart data-table toggles", () => {
  it("shows and hides skill radar data table", () => {
    render(
      <SkillRadarChart
        skills={[
          { category: "Backend", score: 42, delta: 5, note: "Strong backend" },
          { category: "Testing", score: 30, delta: 2, note: "Testing signal" },
        ]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "View data table" });
    fireEvent.click(toggle);
    const region = screen.getByRole("region", { name: /data table/i });
    expect(region).toBeTruthy();
    const table = screen.getByRole("table");
    expect(table).toBeTruthy();
    const tableScope = within(table);
    expect(tableScope.getByText("Skill lane")).toBeTruthy();
    expect(tableScope.getByText("Backend")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide data table" }));
    expect(screen.queryByRole("region", { name: /data table/i })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows and hides timeline data table", () => {
    render(
      <TimelineChart
        data={[
          { id: "april", label: "Apr", xp: 100 },
          { id: "may", label: "May", xp: 180 },
        ]}
      />,
    );

    const toggle = screen.getByRole("button", { name: "View data table" });
    fireEvent.click(toggle);
    const region = screen.getByRole("region", { name: /data table/i });
    expect(region).toBeTruthy();
    const table = screen.getByRole("table");
    expect(table).toBeTruthy();
    const tableScope = within(table);
    expect(tableScope.getByText("Window")).toBeTruthy();
    expect(tableScope.getByText("May")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Hide data table" }));
    expect(screen.queryByRole("region", { name: /data table/i })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
