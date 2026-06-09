import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PRReportBadgeRewardsCard } from "@/features/pr-report/components/PRReportBadgeRewardsCard";
import type { PRReportBadgeReward } from "@/features/pr-report/lib/pr-report-presentation";

describe("PRReportBadgeRewardsCard", () => {
  it("does not render when no badge rewards are available", () => {
    const { container } = render(<PRReportBadgeRewardsCard badges={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("uses singular reward copy for one badge reward", () => {
    render(<PRReportBadgeRewardsCard badges={[buildBadgeReward("test-builder")]} />);

    expect(screen.getByText("Badge rewards", { exact: false })).toBeTruthy();
    expect(screen.getByText("(1 badge reward)")).toBeTruthy();
    expect(screen.getByText("Reward unlocked")).toBeTruthy();
    expect(screen.getByText("Test Builder")).toBeTruthy();
  });

  it("uses formatted plural reward copy for multiple badge rewards", () => {
    render(
      <PRReportBadgeRewardsCard
        badges={[
          buildBadgeReward("test-builder", "Test Builder"),
          buildBadgeReward("multi-repo-operator", "Multi Repo Operator"),
        ]}
      />,
    );

    expect(screen.getByText("(2 badge rewards)")).toBeTruthy();
    expect(screen.getByText("2 badge rewards unlocked")).toBeTruthy();
  });
});

function buildBadgeReward(
  key: string,
  name = "Test Builder",
): PRReportBadgeReward {
  return {
    key,
    name,
    description: `${name} is backed by persisted scoring evidence.`,
    rule: "test_builder",
    ruleVersion: "badges/v1",
    evidenceSignals: ["testing_xp=120", "rule=test_builder"],
  };
}
