import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestPanel } from "@/features/dashboard/components/QuestPanel";
import { buildQuest } from "@/tests/helpers/quest-fixture";

describe("QuestPanel", () => {
  it("renders evidence-first empty copy with sync recovery actions", () => {
    render(<QuestPanel quests={[]} />);

    expect(screen.getByRole("note", { name: "Quests need scored evidence" })).toBeTruthy();
    expect(screen.getByText("Sync PR evidence so missions can target real contribution signals.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open sync settings" }).getAttribute("href")).toBe(
      "/dashboard/settings",
    );
  });

  it("renders repeated quest titles when quest identities differ", () => {
    render(
      <QuestPanel
        quests={[
          buildQuest({ id: "quest-a", title: "Shared quest title" }),
          buildQuest({ id: "quest-b", title: "Shared quest title" }),
        ]}
      />,
    );

    expect(screen.getAllByText("Shared quest title")).toHaveLength(2);
  });

  it("renders normalized evidence chips and linked PR count", () => {
    render(
      <QuestPanel
        quests={[
          buildQuest({
            evidenceSignals: ["review_depth=0", "linked_issues=2"],
            linkedContributionIds: ["pr-1", "pr-2"],
            progress: 1,
            goal: 3,
          }),
        ]}
      />,
    );

    expect(screen.getByText("review_depth=0")).toBeTruthy();
    expect(screen.getByText("2 linked issues")).toBeTruthy();
    expect(screen.getByText("2 linked PRs")).toBeTruthy();
    expect(screen.getByText("1 of 3 steps")).toBeTruthy();
  });
});
