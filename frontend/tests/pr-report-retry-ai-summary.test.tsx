import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";
import { toPullRequestAnalysis } from "@/lib/api/pr-report-api";
import { prReportFixture } from "@/tests/helpers/live-fixtures";

const mockUsePrReport = vi.hoisted(() => vi.fn());
const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockRefetch = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-pr-report", () => ({
  usePrReport: (...args: unknown[]) => mockUsePrReport(...args),
}));

vi.mock("@/hooks/use-account-actions", () => ({
  useRunPullRequestSync: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

describe("pr report ai retry action", () => {
  beforeEach(() => {
    mockUsePrReport.mockReset();
    mockMutateAsync.mockReset();
    mockRefetch.mockReset();
    mockRefetch.mockResolvedValue(undefined);
  });

  it("shows retry action for rate-limited reports and executes pull-request sync", async () => {
    const report = buildReportFixture("rate_limited");
    mockUsePrReport.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    mockMutateAsync.mockResolvedValue({
      status: "completed",
      mode: "pull_request",
      repository: "octo/gitrank",
      number: 42,
      started_at: "2026-05-10T12:00:00Z",
      finished_at: "2026-05-10T12:00:03Z",
      fetched: {},
      persisted: {},
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry AI summary" }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        repository: "octo/gitrank",
        number: 42,
      }),
    );
    expect(await screen.findByText(/Retry executed\./i)).toBeTruthy();
    expect(mockRefetch).toHaveBeenCalled();
  }, 10_000);

  it("hides retry action for complete reports", async () => {
    const report = buildReportFixture("complete");
    mockUsePrReport.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.queryByRole("button", { name: "Retry AI summary" })).toBeNull();
  });
});

function buildReportFixture(
  status: "complete" | "rate_limited" | "deterministic_only",
) {
  return toPullRequestAnalysis({
    ...prReportFixture,
    evidence_state: {
      status,
      reasons: [],
      missing_evidence: [],
      analysis_source: status === "complete" ? "openai" : "deterministic fallback",
      analysis_confidence: 0.63,
      deterministic_only: status === "deterministic_only",
      ai_fallback: false,
      rate_limited: status === "rate_limited",
      stale: false,
    },
  });
}
