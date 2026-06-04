import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

describe("RouteLoadingState", () => {
  it("keeps aria-busy on the visual shell and scopes announcements to one status node", () => {
    const { container } = render(
      <RouteLoadingState
        eyebrow="Dashboard"
        title="Dashboard"
        description="Loading contribution signals."
        variant="dashboard"
      />,
    );

    const shell = container.firstElementChild;
    const status = screen.getByRole("status");
    expect(shell?.getAttribute("aria-busy")).toBe("true");
    expect(shell?.getAttribute("role")).toBeNull();
    expect(status.textContent).toBe("Loading dashboard. Contribution signals.");
    expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
    expect(screen.getAllByText("Dashboard")).toHaveLength(1);
  });

  it("renders a profile-shaped skeleton without duplicating the status announcement", () => {
    const { container } = render(
      <RouteLoadingState
        eyebrow="Public profile"
        title="Contributor profile"
        description="Loading public contribution evidence."
        cardCount={4}
        variant="profile"
      />,
    );

    expect(screen.getByText("Contributor profile")).not.toBeNull();
    expect(screen.getByText("Public profile")).not.toBeNull();
    expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
    expect(container.querySelectorAll(".neon-skeleton").length).toBeGreaterThan(4);
  });

  it("keeps non-loading detail copy intact while preserving progressive route titles", () => {
    render(
      <RouteLoadingState
        eyebrow="Dashboard loading"
        title="Preparing your dashboard"
        description="GitRank is loading contribution signals, scores, quests, and leaderboard context for this view."
        variant="marketing"
      />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Preparing your dashboard. GitRank is loading contribution signals, scores, quests, and leaderboard context for this view.",
    );
  });
});
