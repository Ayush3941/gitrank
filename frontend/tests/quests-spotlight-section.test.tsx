import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestsSpotlightSection } from "@/features/quests/components/QuestsSpotlightSection";
import { buildQuest } from "@/tests/helpers/quest-fixture";

describe("QuestsSpotlightSection", () => {
  it("renders empty recovery cards for missing spotlight quests", () => {
    render(
      <QuestsSpotlightSection
        dailyQuest={null}
        weeklyQuest={null}
        longTermQuest={null}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("Mission spotlight")).toBeTruthy();
    expect(screen.getByRole("note", { name: "Today's Quest evidence pending" })).toBeTruthy();
    expect(screen.getByText("Daily mission needs fresh PR evidence.")).toBeTruthy();
    expect(screen.getByRole("note", { name: "Weekly Challenge evidence pending" })).toBeTruthy();
    expect(
      screen.getByText("Weekly challenge appears after sync scores recent contribution evidence."),
    ).toBeTruthy();
    expect(screen.getByRole("note", { name: "Long-Term Journey evidence pending" })).toBeTruthy();
    expect(
      screen.getByText(
        "Long-term objective needs enough scored history to identify a durable target.",
      ),
    ).toBeTruthy();
  });

  it("renders active quest details and recovery action", () => {
    render(
      <QuestsSpotlightSection
        dailyQuest={buildQuest({
          title: "Daily review loop",
          cadence: "Daily",
          progress: 1,
          goal: 2,
          rewardXp: 80,
        })}
        weeklyQuest={null}
        longTermQuest={null}
        isLoading={false}
        isError={false}
      />,
    );

    expect(screen.getByText("Daily review loop")).toBeTruthy();
    expect(screen.getByText("+80 XP")).toBeTruthy();
    expect(screen.getByText("1 of 2 steps")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("Next move: Open contributions")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open contributions/i })).toBeTruthy();
  });

  it("suppresses spotlight content while loading or failed", () => {
    const { rerender } = render(
      <QuestsSpotlightSection
        dailyQuest={null}
        weeklyQuest={null}
        longTermQuest={null}
        isLoading
        isError={false}
      />,
    );

    expect(screen.queryByText("Mission spotlight")).toBeNull();

    rerender(
      <QuestsSpotlightSection
        dailyQuest={null}
        weeklyQuest={null}
        longTermQuest={null}
        isLoading={false}
        isError
      />,
    );

    expect(screen.queryByText("Mission spotlight")).toBeNull();
  });
});
