import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileBadgesCard } from "@/features/profile/components/PublicProfileBadgesCard";
import type { Badge, BadgeRarity } from "@/types/gitrank";

describe("PublicProfileBadgesCard", () => {
  it("renders the empty badge unlock state", () => {
    render(<PublicProfileBadgesCard badges={[]} />);

    expect(screen.getByRole("note", { name: "Badge unlocks need scored evidence" })).toBeTruthy();
    expect(screen.getByText("Public badge unlocks appear as scored contributions land.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open quests" }).getAttribute("href")).toBe(
      "/dashboard/quests",
    );
  });

  it("renders the top three badge summaries", () => {
    render(
      <PublicProfileBadgesCard
        badges={[
          buildBadge({ id: "first", name: "Consistency 4w", rarity: "Rare" }),
          buildBadge({ id: "second", name: "Test Builder", rarity: "Epic" }),
          buildBadge({ id: "third", name: "Multi Repo Operator", rarity: "Legendary" }),
          buildBadge({ id: "fourth", name: "Hidden fourth badge", rarity: "Mythic" }),
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Top badges" })).toBeTruthy();
    expect(screen.getByText("Consistency 4w")).toBeTruthy();
    expect(screen.getByText("Test Builder")).toBeTruthy();
    expect(screen.getByText("Multi Repo Operator")).toBeTruthy();
    expect(screen.queryByText("Hidden fourth badge")).toBeNull();
    expect(screen.getByText("Rare")).toBeTruthy();
    expect(screen.getByText("Epic")).toBeTruthy();
    expect(screen.getByText("Legendary")).toBeTruthy();
  });
});

function buildBadge({
  id,
  name,
  rarity,
}: {
  id: string;
  name: string;
  rarity: BadgeRarity;
}): Badge {
  return {
    id,
    name,
    rarity,
    description: `${name} is backed by scored contribution evidence.`,
    unlockCondition: "Earn deterministic contribution evidence.",
    icon: "bolt",
    unlocked: true,
    progress: 100,
    evidencePrIds: [],
  };
}
