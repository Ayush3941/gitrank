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

    expect(screen.getByText("Status: All")).toBeTruthy();
    expect(screen.queryByText(/Active:/)).toBeNull();
    expect(screen.queryByText(/Search:/)).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Search sync runs" }), {
      target: { value: "missing-run" },
    });

    expect(screen.getByText("Search: missing-run")).toBeTruthy();
    expect(screen.getByText("Active: 1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset" })).toBeTruthy();
    expect(screen.getByText("No sync runs match the current search or status filter.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    const searchBox = screen.getByRole("textbox", { name: "Search sync runs" }) as HTMLInputElement;
    expect(searchBox.value).toBe("");
    expect(screen.queryByText("Search: missing-run")).toBeNull();
  });
});
