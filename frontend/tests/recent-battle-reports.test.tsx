import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RecentBattleReports } from "@/features/dashboard/components/RecentBattleReports";
import type { PullRequestAnalysis } from "@/types/gitrank";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("RecentBattleReports", () => {
  it("renders repeated report titles when PR identities differ", () => {
    render(
      <RecentBattleReports
        reports={[
          buildReport({ id: "report-a", number: 41 }),
          buildReport({ id: "report-b", number: 42 }),
        ]}
      />,
    );

    expect(screen.getAllByText("Shared report title")).toHaveLength(2);
    expect(screen.getByText("octo/gitrank #41")).toBeTruthy();
    expect(screen.getByText("octo/gitrank #42")).toBeTruthy();
  });

  it("keeps the strongest duplicate PR report", () => {
    render(
      <RecentBattleReports
        reports={[
          buildReport({ id: "low", xpEarned: 40 }),
          buildReport({ id: "high", xpEarned: 400 }),
        ]}
      />,
    );

    expect(screen.getByText("400")).toBeTruthy();
    expect(screen.queryByText("40")).toBeNull();
  });
});

function buildReport(
  overrides: Partial<PullRequestAnalysis["contribution"]> = {},
): PullRequestAnalysis {
  return {
    contribution: {
      id: overrides.id ?? "report",
      owner: overrides.owner ?? "octo",
      repo: overrides.repo ?? "gitrank",
      number: overrides.number ?? 42,
      title: overrides.title ?? "Shared report title",
      category: overrides.category ?? "Backend",
      xpEarned: overrides.xpEarned ?? 320,
      aiSummary: overrides.aiSummary ?? "Persisted report summary.",
    },
    aiConfidence: 0.8,
    evidenceState: {
      status: "complete",
      analysisSource: "openai",
    },
  } as PullRequestAnalysis;
}
