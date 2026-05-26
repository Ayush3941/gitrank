import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileHero } from "@/features/profile/components/PublicProfileHero";
import type { UserProfile } from "@/types/gitrank";

describe("public profile hero", () => {
  it("exposes backend card JSON link for the current handle", () => {
    const user = {
      avatarUrl: "https://example.com/avatar.png",
      displayName: "Octo User",
      username: "octo/user",
      title: "Systems Builder",
      bio: "Public profile bio",
      mergedPrCount: 12,
      gitRankScore: 1337,
      consistencyScore: 84,
      topSkills: ["Backend", "Testing"],
      contributions: [],
      level: {
        currentLevel: 7,
        title: "Gold",
        currentXp: 2468,
        nextLevelXp: 3000,
        rankTier: "Gold III",
      },
      rankProgress: {
        season: {
          id: "season-1",
          name: "Season 1",
          windowLabel: "May",
          startsAt: "2026-05-01T00:00:00Z",
          endsAt: "2026-05-31T23:59:59Z",
          status: "Active",
          scoringVersion: "v1alpha1",
          promotionRule: "Top 25",
          resetRule: "Weekly",
          promotionCutoffRank: 25,
          safetyCutoffRank: 75,
          explanation: "test",
        },
        currentTier: "Gold III",
        seasonXp: 400,
        xpToNextTier: 100,
        promotionCutoffRank: 25,
        safetyCutoffRank: 75,
        evidenceSignals: [],
      },
    } as unknown as UserProfile;

    render(
      <PublicProfileHero
        user={user}
        shareHeadline="Share headline"
      />,
    );

    const link = screen.getByRole("link", { name: /View card JSON/i });
    expect(link.getAttribute("href")).toBe("/api/profile/public/octo%2Fuser/card");
  });
});
