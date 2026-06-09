import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BadgesShelfResults } from "@/features/badges/components/BadgesShelfResults";
import type { Badge } from "@/types/gitrank";

describe("BadgesShelfResults", () => {
  it("renders the filtered empty state with reset action", async () => {
    const onResetFilters = vi.fn();

    render(
      <BadgesShelfResults
        visibleBadges={[]}
        isLoading={false}
        isError={false}
        filteredCount={0}
        totalCount={3}
        canResetFilters
        hasMoreBadges={false}
        remainingBadges={0}
        regionId="badge-shelf"
        onRetry={vi.fn()}
        onResetFilters={onResetFilters}
        onShowMoreBadges={vi.fn()}
      />,
    );

    expect(screen.getByText("No badges match current filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("renders badge grid results and the show-more action", async () => {
    const onShowMoreBadges = vi.fn();

    render(
      <BadgesShelfResults
        visibleBadges={[buildBadge()]}
        isLoading={false}
        isError={false}
        filteredCount={2}
        totalCount={2}
        canResetFilters={false}
        hasMoreBadges
        remainingBadges={1}
        regionId="badge-shelf"
        onRetry={vi.fn()}
        onResetFilters={vi.fn()}
        onShowMoreBadges={onShowMoreBadges}
      />,
    );

    expect(await screen.findByText("Shipwright")).toBeTruthy();
    expect(screen.getByText("1 badge remaining")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show more badges. 1 badge remaining." }));
    expect(onShowMoreBadges).toHaveBeenCalledTimes(1);
  });
});

function buildBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: overrides.id ?? "badge-1",
    name: overrides.name ?? "Shipwright",
    rarity: overrides.rarity ?? "Rare",
    description: overrides.description ?? "Evidence-backed contribution badge.",
    unlockCondition: overrides.unlockCondition ?? "Land a scored PR.",
    icon: overrides.icon ?? "bolt",
    unlocked: overrides.unlocked ?? true,
    earnedAt: overrides.earnedAt ?? "2026-05-25T10:00:00.000Z",
    progress: overrides.progress ?? 100,
    evidencePrIds: overrides.evidencePrIds ?? [],
    rarityScore: overrides.rarityScore,
  };
}
