import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileTimelineCard } from "@/features/profile/components/PublicProfileTimelineCard";

describe("PublicProfileTimelineCard", () => {
  it("renders the empty timeline signal state", () => {
    render(
      <PublicProfileTimelineCard
        timeline={[]}
        trendWindowLabel="Last 6 weeks"
        constrainedNetwork={false}
      />,
    );

    expect(screen.getByRole("note", { name: "Timeline needs scored history" })).toBeTruthy();
    expect(
      screen.getByText("XP trend appears after synced scored history spans the selected window."),
    ).toBeTruthy();
    expect(screen.getByText("Last 6 weeks")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open contributions" }).getAttribute("href")).toBe(
      "/dashboard/contributions",
    );
  });

  it("renders the constrained-network timeline summary", () => {
    render(
      <PublicProfileTimelineCard
        trendWindowLabel="Last 6 weeks"
        constrainedNetwork
        timeline={[
          { id: "week-1", label: "Week 1", xp: 10 },
          { id: "week-2", label: "Week 2", xp: 20 },
          { id: "week-3", label: "Week 3", xp: 15 },
          { id: "week-4", label: "Week 4", xp: 30 },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "XP timeline" })).toBeTruthy();
    expect(screen.getByText("Latest XP snapshot")).toBeTruthy();
    expect(screen.getByText("Rising")).toBeTruthy();
    expect(screen.getByText("30 XP")).toBeTruthy();
    expect(screen.getByText(/Recent window change: \+20 XP/)).toBeTruthy();
    expect(screen.getByText("Week 4")).toBeTruthy();
    expect(screen.getByText("30")).toBeTruthy();
  });
});
