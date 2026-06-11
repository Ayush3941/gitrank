import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BadgesOverviewCard } from "@/features/badges/components/BadgesOverviewCard";

describe("BadgesOverviewCard", () => {
  it("formats badge totals and streak days with shared readable labels", () => {
    render(
      <BadgesOverviewCard
        archetype="Quality Champion"
        identitySummary="Badge evidence summary."
        unlockedCount={1200}
        completionPercent={50}
        level={12}
        streakDays={1}
        unlockNotice=""
        nextUnlockTarget={null}
        onDismissUnlockNotice={vi.fn()}
      />,
    );

    expect(screen.getByText("1,200")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("1 day")).toBeTruthy();
  });
});
