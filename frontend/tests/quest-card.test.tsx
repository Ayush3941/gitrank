import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestCard } from "@/features/quests/components/QuestCard";
import { buildQuest } from "@/tests/helpers/quest-fixture";

describe("QuestCard", () => {
  it("renders quest evidence chips without dropping linked evidence counts", () => {
    render(
      <QuestCard
        quest={buildQuest({
          id: "quest-card",
          evidenceSignals: ["rule=quest_reward", "linked_issues=1"],
          linkedContributionIds: ["pr-1"],
        })}
      />,
    );

    expect(screen.getByText("Trigger Quest Reward")).toBeTruthy();
    expect(screen.getByText("1 linked issue")).toBeTruthy();
    expect(screen.getByText("1 evidence PR")).toBeTruthy();
  });
});
