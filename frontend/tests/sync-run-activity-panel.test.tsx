import React, { type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncRunActivityPanel } from "@/features/settings/components/SyncRunActivityPanel";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const sampleRun = {
  id: "run_1",
  run_type: "user",
  status: "completed",
  subject: "octocat",
  started_at: "2026-05-25T00:00:00Z",
  finished_at: "2026-05-25T00:02:00Z",
  metrics: {
    pull_requests: 3,
    fetched_pull_requests: 5,
    reviews: 2,
    fetched_reviews: 4,
    reviews_skipped: 1,
  },
};

describe("SyncRunActivityPanel", () => {
  it("keeps summary-first filters and reset flow consistent", () => {
    render(
      <SyncRunActivityPanel
        runs={[sampleRun]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("View: All")).toBeTruthy();
    expect(screen.queryByText(/Active:/)).toBeNull();
    expect(screen.queryByText(/Search:/)).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Search sync runs" }), {
      target: { value: "missing-run" },
    });

    expect(screen.getByText("Search: missing-run")).toBeTruthy();
    expect(screen.getByText("Active: 1")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Reset filters" }).length).toBeGreaterThan(0);
    expect(screen.getByText("No sync runs match the current search or status filter.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Reset filters" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);

    const searchBox = screen.getByRole("textbox", { name: "Search sync runs" }) as HTMLInputElement;
    expect(searchBox.value).toBe("");
    expect(screen.queryByText("Search: missing-run")).toBeNull();
  });

  it("renders compact fetched/persisted metrics summaries when run metrics exist", () => {
    render(
      <SyncRunActivityPanel
        runs={[sampleRun]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("PRs 3/5 · Reviews 2/4 · Skipped 1")).toBeTruthy();
  });
});
