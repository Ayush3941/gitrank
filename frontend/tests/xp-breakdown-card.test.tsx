import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { XPBreakdownCard } from "@/features/pr-report/components/XPBreakdownCard";
import { toPullRequestAnalysis } from "@/lib/api/pr-report-api";
import { prReportFixture } from "@/tests/helpers/live-fixtures";

describe("XPBreakdownCard", () => {
  it("renders every persisted component, including zero XP and penalties beyond the first three rows", () => {
    const report = toPullRequestAnalysis({
      ...prReportFixture,
      contribution: { ...prReportFixture.contribution, xp_earned: 0 },
      score_components: [
        { ...prReportFixture.score_components[0], value: 0, display_value: "0 XP" },
        prReportFixture.score_components[1],
        {
          key: "outcome_weight",
          label: "Outcome weight",
          value: 1,
          display_value: "1.00x",
          source: "score_event_metadata",
          reason: "Merged outcome weight recorded by the scorer.",
        },
        {
          key: "spam_penalty",
          label: "Spam penalty",
          value: 0.05,
          display_value: "-5%",
          source: "score_event_metadata",
          reason: "Small-change penalty recorded by the scorer.",
        },
        {
          key: "self_merged_exclusion",
          label: "Self-merge exclusion",
          value: 0,
          display_value: "0 XP",
          source: "score_event_metadata",
          reason: "Self-merged pull requests are excluded from XP.",
        },
      ],
      penalties: [
        {
          label: "Pending requested changes",
          delta_xp: -35,
          type: "penalty",
          reason: "Legacy report estimate.",
        },
      ],
    });

    render(<XPBreakdownCard report={report} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(within(rows[0]).getByText("Final XP")).toBeTruthy();
    expect(within(rows[0]).getByText("0 XP")).toBeTruthy();
    expect(within(rows[3]).getByText("Spam penalty")).toBeTruthy();
    expect(within(rows[3]).getByText("-5%")).toBeTruthy();
    expect(within(rows[4]).getByText("Self-merge exclusion")).toBeTruthy();
    expect(screen.queryByText(/more components available/)).toBeNull();
    expect(screen.queryByText("Pending requested changes")).toBeNull();
    expect(screen.queryByText("Anti-spam multiplier")).toBeNull();
  });

  it.each([undefined, []])(
    "shows unavailable details instead of synthesizing XP bonuses when components are %j",
    (scoreComponents) => {
      const report = toPullRequestAnalysis({
        ...prReportFixture,
        score_components: scoreComponents,
      });

      render(<XPBreakdownCard report={report} />);

      expect(
        screen.getByRole("note", { name: "Score details unavailable" }),
      ).toBeTruthy();
      expect(
        screen.getByText("No persisted scoring components are attached to this report."),
      ).toBeTruthy();
      expect(screen.queryByRole("list")).toBeNull();
      expect(screen.queryByText(/bonus/i)).toBeNull();
      expect(screen.queryByText("Transparent formula")).toBeNull();
      expect(screen.queryByText("Anti-spam multiplier")).toBeNull();
    },
  );
});
