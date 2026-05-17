import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DashboardTopBar } from "@/components/shared/DashboardTopBar";
import type { UserProfile } from "@/types/gitrank";

describe("DashboardTopBar", () => {
  const userFixture = {
    username: "octocat",
    displayName: "Octo Cat",
    title: "Systems Builder",
    weeklyXp: 120,
    syncStatus: {
      state: "stale",
      lastSyncedAt: "2026-05-17T17:30:00.000Z",
      partialProfileAvailable: false,
    },
    level: {
      rankTier: "Bronze I",
    },
  } as const;

  it("renders background sync note when provided", () => {
    render(
      <DashboardTopBar
        user={userFixture as unknown as UserProfile}
        autoSyncNote={{
          tone: "info",
          message: "Background sync is running. Keep exploring while GitRank refreshes evidence.",
        }}
      />,
    );

    expect(
      screen.getByText(
        "Background sync is running. Keep exploring while GitRank refreshes evidence.",
      ),
    ).toBeTruthy();
  });
});
