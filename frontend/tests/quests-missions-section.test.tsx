import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuestsMissionsSection } from "@/features/quests/components/QuestsMissionsSection";
import type { QuestGroupMap } from "@/features/quests/lib/quests-page-model";
import { buildQuest } from "@/tests/helpers/quest-fixture";
import type { Quest } from "@/types/gitrank";

const emptyQuestMap: QuestGroupMap = {
  Daily: [],
  Weekly: [],
  "Long-term": [],
  "Skill-based": [],
};

const defaultVisibleCounts: Record<Quest["cadence"], number> = {
  Daily: 1,
  Weekly: 1,
  "Long-term": 1,
  "Skill-based": 1,
};

describe("QuestsMissionsSection", () => {
  it("renders the empty quest state", () => {
    render(
      <QuestsMissionsSection
        quests={[]}
        visibleGroups={[]}
        questMap={emptyQuestMap}
        visibleGroupCounts={defaultVisibleCounts}
        questGroupPageSize={1}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onShowMoreGroup={vi.fn()}
      />,
    );

    expect(screen.getByText("No quests ready yet.")).toBeTruthy();
  });

  it("delegates retry from the error state", () => {
    const onRetry = vi.fn();

    render(
      <QuestsMissionsSection
        quests={[]}
        visibleGroups={[]}
        questMap={emptyQuestMap}
        visibleGroupCounts={defaultVisibleCounts}
        questGroupPageSize={1}
        isLoading={false}
        isError
        onRetry={onRetry}
        onShowMoreGroup={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders grouped quests and delegates show-more pagination", async () => {
    const onShowMoreGroup = vi.fn();
    const weeklyQuests = [
      buildQuest({ id: "quest-1", title: "Weekly review sprint" }),
      buildQuest({ id: "quest-2", title: "Weekly test sprint" }),
    ];

    render(
      <QuestsMissionsSection
        quests={weeklyQuests}
        visibleGroups={["Weekly"]}
        questMap={{ ...emptyQuestMap, Weekly: weeklyQuests }}
        visibleGroupCounts={defaultVisibleCounts}
        questGroupPageSize={1}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onShowMoreGroup={onShowMoreGroup}
      />,
    );

    expect(
      await screen.findByText("Weekly review sprint", undefined, {
        timeout: 5_000,
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Weekly test sprint")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show more missions" }));
    expect(onShowMoreGroup).toHaveBeenCalledWith("Weekly", 2);
  });

  it("renders repeated visible quest titles when quest identities differ", async () => {
    const weeklyQuests = [
      buildQuest({ id: "quest-a", title: "Shared mission title" }),
      buildQuest({ id: "quest-b", title: "Shared mission title" }),
    ];

    render(
      <QuestsMissionsSection
        quests={weeklyQuests}
        visibleGroups={["Weekly"]}
        questMap={{ ...emptyQuestMap, Weekly: weeklyQuests }}
        visibleGroupCounts={{ ...defaultVisibleCounts, Weekly: 2 }}
        questGroupPageSize={1}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onShowMoreGroup={vi.fn()}
      />,
    );

    expect(
      await screen.findAllByText("Shared mission title", undefined, {
        timeout: 5_000,
      }),
    ).toHaveLength(2);
  });
});
