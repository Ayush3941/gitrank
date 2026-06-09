import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BadgesLockedPathsSection } from "@/features/badges/components/BadgesLockedPathsSection";
import { buildBadge } from "@/tests/helpers/gitrank-fixtures";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("BadgesLockedPathsSection", () => {
  it("renders plural-aware remaining copy and contextual show-more action", () => {
    const onShowMoreLockedBadges = vi.fn();
    render(
      <BadgesLockedPathsSection
        lockedBadges={[
          buildBadge({ id: "locked-a", name: "Locked A", unlocked: false, progress: 40 }),
          buildBadge({ id: "locked-b", name: "Locked B", unlocked: false, progress: 20 }),
        ]}
        lockedBadgePreview={[]}
        visibleLockedBadges={[
          buildBadge({ id: "locked-a", name: "Locked A", unlocked: false, progress: 40 }),
        ]}
        hasMoreLockedBadges
        remainingLockedBadges={1}
        showLockedBadges
        isLoading={false}
        isError={false}
        regionId="locked-badges-region"
        toggleId="locked-badges-toggle"
        onToggleLockedBadges={vi.fn()}
        onShowMoreLockedBadges={onShowMoreLockedBadges}
      />,
    );

    expect(screen.getByText("1 locked path remaining")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show more locked paths. 1 locked path remaining.",
      }),
    );
    expect(onShowMoreLockedBadges).toHaveBeenCalledTimes(1);
  });
});
