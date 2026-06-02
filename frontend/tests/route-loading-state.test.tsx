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
    expect(status.textContent).toContain("Loading Dashboard. Loading contribution signals.");
    expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
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
    expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
    expect(container.querySelectorAll(".neon-skeleton").length).toBeGreaterThan(4);
  });
});
