import { describe, expect, it } from "vitest";
import {
  formatQuestProgressLabel,
  questProgressPercent,
  selectQuestSpotlight,
} from "@/features/quests/lib/quest-spotlight";
import { buildQuest } from "@/tests/helpers/quest-fixture";

describe("selectQuestSpotlight", () => {
  it("prefers active quests, then progress, reward, and title", () => {
    const selected = selectQuestSpotlight([
      buildQuest({
        id: "completed-high-progress",
        title: "Completed high progress",
        status: "Completed",
        progress: 10,
        goal: 10,
        rewardXp: 500,
      }),
      buildQuest({
        id: "active-lower-progress",
        title: "Active lower progress",
        status: "Active",
        progress: 2,
        goal: 10,
        rewardXp: 400,
      }),
      buildQuest({
        id: "active-higher-progress",
        title: "Active higher progress",
        status: "Active",
        progress: 7,
        goal: 10,
        rewardXp: 100,
      }),
    ]);

    expect(selected?.id).toBe("active-higher-progress");
  });

  it("returns null for an empty source", () => {
    expect(selectQuestSpotlight([])).toBeNull();
  });
});

describe("questProgressPercent", () => {
  it("handles missing or invalid goals without dividing by zero", () => {
    expect(questProgressPercent(buildQuest({ progress: 1, goal: 0 }))).toBe(100);
  });
});

describe("formatQuestProgressLabel", () => {
  it("uses shared count-of-total wording for quest steps", () => {
    expect(formatQuestProgressLabel(buildQuest({ progress: 1, goal: 1 }))).toBe("1 of 1 step");
    expect(formatQuestProgressLabel(buildQuest({ progress: 1, goal: 3 }))).toBe("1 of 3 steps");
  });
});
