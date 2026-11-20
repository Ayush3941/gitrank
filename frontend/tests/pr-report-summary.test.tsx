import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";
import { toPullRequestAnalysis } from "@/lib/api/pr-report-api";
import { prReportFixture } from "@/tests/helpers/live-fixtures";

const mocks = vi.hoisted(() => ({ query: vi.fn(), generate: vi.fn(), refetch: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/hooks/use-pr-report", () => ({ usePrReport: mocks.query }));
vi.mock("@/features/pr-report/data/summary-stream", () => ({ generatePRSummary: mocks.generate }));
vi.mock("@/lib/api/analytics-api", () => ({ emitAnalyticsEvent: vi.fn() }));

function report() {
  return { data: toPullRequestAnalysis(prReportFixture), isLoading: false, isError: false, refetch: vi.fn() };
}

describe("on-demand PR explanation", () => {
  beforeEach(() => { mocks.query.mockReset(); mocks.generate.mockReset(); mocks.query.mockReturnValue(report()); });

  it("renders a complete deterministic report with an idle generation button", () => {
    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);
    expect(screen.getByRole("button", { name: "Generate AI summary" })).toBeTruthy();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(screen.queryByText("Report processing state")).toBeNull();
    expect(screen.queryByText("Rate limited")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry AI summary" })).toBeNull();
  });

  it("generates text only after the action and keeps it out of the report model", async () => {
    mocks.generate.mockImplementation(async (...args: unknown[]) => { (args[4] as (text: string) => void)("This change makes the client's workflow easier to understand."); });
    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate AI summary" }));
    expect(await screen.findByText("This change makes the client's workflow easier to understand.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Copy AI summary" })).toBeTruthy());
    expect(mocks.generate).toHaveBeenCalledTimes(1);
    expect(mocks.generate.mock.calls[0].slice(0, 3)).toEqual(["octo", "gitrank", 42]);
    expect(report().data.contribution).not.toHaveProperty("aiSummary");
  });

  it("keeps provider errors in the action panel without changing PR completeness", async () => {
    mocks.generate.mockRejectedValue(new Error("The AI provider is currently at its request or usage limit."));
    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate AI summary" }));
    expect(await screen.findByText("The AI provider is currently at its request or usage limit.")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
    expect(screen.queryByText("Rate limited")).toBeNull();
    expect(screen.queryByText("Report processing state")).toBeNull();
  });

  it("allows generation to be stopped", async () => {
    let signal: AbortSignal | undefined;
    mocks.generate.mockImplementation((...args: unknown[]) => new Promise<void>((resolve) => { signal = args[3] as AbortSignal; signal.addEventListener("abort", () => resolve()); }));
    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate AI summary" }));
    expect(screen.getByRole("button", { name: "Generating summary" }).hasAttribute("disabled")).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Stop" })); });
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole("button", { name: "Copy AI summary" })).toBeNull();
  });

  it("respects summary privacy", () => {
    mocks.query.mockReturnValue({ ...report(), data: toPullRequestAnalysis({ ...prReportFixture, ai_summary_visible: false }) });
    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);
    expect(screen.queryByRole("button", { name: "Generate AI summary" })).toBeNull();
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});

describe("pr report public recovery states", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.generate.mockReset();
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
  });

  it("does not render a hidden AI narrative, copy action, or retry action", () => {
    mocks.query.mockReturnValue({
      data: toPullRequestAnalysis({ ...prReportFixture, ai_summary_visible: false }),
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });

    const rendered = render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(rendered.container.querySelector("#pr-report-summary")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy AI summary" })).toBeNull();
    expect(screen.queryByRole("button", { name: /generate ai summary/i })).toBeNull();
    expect(screen.queryByRole("link", { name: "Summary" })).toBeNull();
  });

  it("keeps fetch-error recovery on public evidence destinations", async () => {
    mocks.query.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mocks.refetch,
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
    await waitFor(() => expect(mocks.refetch).toHaveBeenCalledTimes(1));
  });

  it("keeps missing-report recovery visitor-safe", () => {
    mocks.query.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
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


describe("pr report metric ledger", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.generate.mockReset();
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
  });

  it("keeps metric descriptions semantic without hover-only title text", () => {
    mocks.query.mockReturnValue({
      data: toPullRequestAnalysis(prReportFixture),
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
    });

    render(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(screen.getByText("8 metrics")).toBeTruthy();
    expect(screen.getByText("3 metrics")).toBeTruthy();

    const metricLabel = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === "dt" && content === "Difficulty score";
    });
    const metricCell = metricLabel.closest("div");
    if (!metricCell) {
      throw new Error("Expected difficulty metric cell to render.");
    }
    const metricValue = metricCell.querySelector("dd[aria-describedby]");
    if (!metricValue) {
      throw new Error("Expected difficulty metric value to reference its description.");
    }
    const descriptionId = metricValue.getAttribute("aria-describedby");
    expect(metricValue.hasAttribute("title")).toBe(false);
    expect(descriptionId).toBeTruthy();

    const description = document.getElementById(descriptionId ?? "");
    expect(description?.textContent).toBe("Complexity signal from size and code surface.");
    expect(description?.className).toContain("sr-only");

    fireEvent.click(screen.getByRole("button", { name: "Show metric notes" }));

    expect(description?.className).not.toContain("sr-only");
    expect(screen.getByText("Complexity signal from size and code surface.")).toBeTruthy();
  });
});
