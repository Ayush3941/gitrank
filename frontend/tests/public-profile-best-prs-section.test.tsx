import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicProfileBestPRsSection } from "@/features/profile/components/PublicProfileBestPRsSection";
import type { FeaturedContribution } from "@/types/gitrank";

describe("PublicProfileBestPRsSection", () => {
  it("renders the constrained-network empty battle report state", () => {
    render(
      <PublicProfileBestPRsSection
        reports={[]}
        reportDetails={[]}
        constrainedNetwork
      />,
    );

    expect(screen.getByRole("note", { name: "No visible PR evidence" })).toBeTruthy();
    expect(screen.getByText("This profile snapshot has no public battle reports to display.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open contributions" }).getAttribute("href")).toBe(
      "/dashboard/contributions",
    );
  });

  it("renders the constrained-network top four reports", () => {
    render(
      <PublicProfileBestPRsSection
        constrainedNetwork
        reportDetails={[]}
        reports={[
          buildReport({ id: "one", title: "Improve API scoring", xpEarned: 420 }),
          buildReport({ id: "two", title: "Add regression coverage", number: 43, xpEarned: -12 }),
          buildReport({ id: "three", title: "Refine sync UI", number: 44 }),
          buildReport({ id: "four", title: "Harden profile shell", number: 45 }),
          buildReport({ id: "five", title: "Hidden fifth report", number: 46 }),
        ]}
      />,
    );

    expect(screen.getByText("Improve API scoring")).toBeTruthy();
    expect(screen.getByText("Add regression coverage")).toBeTruthy();
    expect(screen.getByText("Refine sync UI")).toBeTruthy();
    expect(screen.getByText("Harden profile shell")).toBeTruthy();
    expect(screen.queryByText("Hidden fifth report")).toBeNull();
    expect(screen.getByText("octo/api #42", { exact: false })).toBeTruthy();
    expect(screen.getByText("+420 XP")).toBeTruthy();
    expect(screen.getByText("-12 XP")).toBeTruthy();
  });
});

function buildReport(overrides: Partial<FeaturedContribution> = {}): FeaturedContribution {
  return {
    id: overrides.id ?? "report",
    owner: overrides.owner ?? "octo",
    repo: overrides.repo ?? "api",
    number: overrides.number ?? 42,
    title: overrides.title ?? "Improve scoring",
    status: overrides.status ?? "merged",
    summary: overrides.summary ?? "Deterministic summary",
    xpEarned: overrides.xpEarned ?? 100,
    happenedAt: overrides.happenedAt ?? "2026-05-25T10:00:00.000Z",
    scoreEventId: overrides.scoreEventId,
    scoreVersion: overrides.scoreVersion,
    formulaVersion: overrides.formulaVersion,
    pullRequestId: overrides.pullRequestId,
    analysisId: overrides.analysisId,
    evidenceState: overrides.evidenceState,
    evidenceMissing: overrides.evidenceMissing,
  };
}
