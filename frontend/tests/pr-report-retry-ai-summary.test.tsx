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

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: vi.fn(),
}));

describe("pr report public recovery states", () => {
  beforeEach(() => {
    mockUsePrReport.mockReset();
    mockMutateAsync.mockReset();
    mockRefetch.mockReset();
    mockRefetch.mockResolvedValue(undefined);
  });

  it("keeps fetch-error recovery on public evidence destinations", async () => {
    mockUsePrReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.getByRole("heading", { name: "Battle report failed" })).toBeTruthy();
    expect(
      screen.getByText(
        "Retry this report fetch, or open the leaderboard while report evidence refreshes.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.queryByRole("link", { name: "Open contributions" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  });

  it("keeps missing-report recovery visitor-safe", () => {
    mockUsePrReport.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.getByRole("heading", { name: "Battle report unavailable" })).toBeTruthy();
    expect(
      screen.getByText(
        "This PR may still be syncing, may be private, or may not have published score evidence yet.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.queryByRole("link", { name: "Open contributions" })).toBeNull();
  });
});

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

  it("keeps retry failure copy independent from private settings routes", async () => {
    const report = buildReportFixture("rate_limited");
    mockUsePrReport.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    mockMutateAsync.mockRejectedValue(new Error(""));

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    fireEvent.click(await screen.findByRole("button", { name: "Retry AI summary" }));

    expect(
      await screen.findByText(
        "Retry failed. Try again after a short delay while report evidence refreshes.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Settings/i)).toBeNull();
  });

  it("hides retry action for complete reports", async () => {
    const report = buildReportFixture("complete");
    mockUsePrReport.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.queryByRole("link", { name: "Back to contributions" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry AI summary" })).toBeNull();
  });
});

describe("pr report metric ledger", () => {
  beforeEach(() => {
    mockUsePrReport.mockReset();
    mockMutateAsync.mockReset();
    mockRefetch.mockReset();
    mockRefetch.mockResolvedValue(undefined);
  });

  it("keeps metric descriptions semantic without hover-only title text", () => {
    mockUsePrReport.mockReturnValue({
      data: buildReportFixture("complete"),
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.getByText("2 metrics")).toBeTruthy();
    expect(screen.getByText("8 metrics")).toBeTruthy();
    expect(screen.getByText("3 metrics")).toBeTruthy();

    const xpMetricLabel = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === "dt" && content === "XP earned";
    });
    const xpMetricCell = xpMetricLabel.closest("div");
    if (!xpMetricCell) {
      throw new Error("Expected XP earned metric cell to render.");
    }
    const xpValue = xpMetricCell.querySelector("dd[aria-describedby]");
    if (!xpValue) {
      throw new Error("Expected XP earned metric value to reference its description.");
    }
    const descriptionId = xpValue.getAttribute("aria-describedby");
    expect(xpValue.hasAttribute("title")).toBe(false);
    expect(descriptionId).toBeTruthy();

    const description = document.getElementById(descriptionId ?? "");
    expect(description?.textContent).toBe("Final deterministic XP after multipliers and penalties.");
    expect(description?.className).toContain("sr-only");

    fireEvent.click(screen.getByRole("button", { name: "Show metric notes" }));

    expect(description?.className).not.toContain("sr-only");
    expect(screen.getByText("Final deterministic XP after multipliers and penalties.")).toBeTruthy();
  });

  it("uses readable pending copy when score-version metadata is unavailable", () => {
    const report = {
      ...buildReportFixture("complete"),
      scoreVersion: undefined,
    };
    mockUsePrReport.mockReturnValue({
      data: report,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.getByText("Score version pending")).toBeTruthy();
    expect(screen.queryByText("unknown")).toBeNull();
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
