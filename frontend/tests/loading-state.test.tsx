import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState } from "@/components/shared/LoadingState";

describe("LoadingState", () => {
  it("keeps the visual shell busy while limiting announcements to one status node", () => {
    const { container } = render(<LoadingState message="Loading badge shelf..." />);

    const shell = container.firstElementChild;
    const status = screen.getByRole("status");
    expect(shell?.getAttribute("aria-busy")).toBe("true");
    expect(shell?.getAttribute("role")).toBeNull();
    expect(status.textContent).toContain("Loading. Loading badge shelf...");
    expect(container.querySelectorAll("[role='status']")).toHaveLength(1);
  });

  it("keeps the visible card concise and leaves skeleton bars outside the live region", () => {
    const { container } = render(<LoadingState message="Loading leaderboard..." />);

    const status = screen.getByRole("status");
    expect(screen.getByText("Loading leaderboard...")).not.toBeNull();
    expect(container.querySelectorAll(".neon-skeleton")).toHaveLength(2);
    expect(status.querySelector(".neon-skeleton")).toBeNull();
    expect(screen.queryByText("Checking latest evidence.")).toBeNull();
  });
});
