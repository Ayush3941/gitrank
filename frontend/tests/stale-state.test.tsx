import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StaleState } from "@/components/shared/StaleState";

describe("StaleState", () => {
  it("renders exact verification timestamp hint when updatedAt is provided", () => {
    render(
      <StaleState
        message="Leaderboard context refreshed 2h ago."
        updatedAt="2026-05-17T18:10:00.000Z"
        actionLabel="Open settings"
        actionHref="/dashboard/settings"
      />,
    );

    expect(screen.getByText(/Last verified at/i)).toBeTruthy();
  });
});
