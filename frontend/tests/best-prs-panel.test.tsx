import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BestPRsPanel } from "@/features/profile/components/BestPRsPanel";
import type { FeaturedContribution } from "@/types/gitrank";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("BestPRsPanel", () => {
  it("renders evidence-first public empty copy", () => {
    render(<BestPRsPanel reports={[]} />);

    expect(screen.getByRole("note", { name: "No visible PR evidence" })).toBeTruthy();
    expect(screen.getByText("This profile snapshot has no public PR reports to display.")).toBeTruthy();
  });

  it("renders repeated best-PR titles when PR identities differ", () => {
    render(
      <BestPRsPanel
        reports={[
          buildReport({ id: "one", number: 41 }),
          buildReport({ id: "two", number: 42 }),
        ]}
      />,
    );

    expect(screen.getAllByText("Shared best PR title")).toHaveLength(2);
    expect(screen.getByText("octo/api #41", { exact: false })).toBeTruthy();
    expect(screen.getByText("octo/api #42", { exact: false })).toBeTruthy();
  });

  it("keeps the highest-XP duplicate PR", () => {
    render(
      <BestPRsPanel
        reports={[
          buildReport({ id: "low", xpEarned: 25 }),
          buildReport({ id: "high", xpEarned: 250 }),
        ]}
      />,
    );

    expect(screen.getByText("250")).toBeTruthy();
    expect(screen.queryByText("25")).toBeNull();
  });
});

function buildReport(overrides: Partial<FeaturedContribution> = {}): FeaturedContribution {
  return {
    id: overrides.id ?? "report",
    owner: overrides.owner ?? "octo",
    repo: overrides.repo ?? "api",
    number: overrides.number ?? 42,
    title: overrides.title ?? "Shared best PR title",
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
