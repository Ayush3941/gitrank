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

const failedRun = {
  id: "run_failed_1",
  run_type: "user",
  status: "failed",
  subject: "octocat",
  started_at: "2026-05-25T00:00:00Z",
  finished_at: "2026-05-25T00:00:20Z",
  metrics: {
    failed: 1,
    timeout_errors: 1,
  },
  last_error: "context deadline exceeded (Client.Timeout exceeded while awaiting headers)",
};

const conflictRun = {
  id: "run_conflict_1",
  run_type: "user",
  status: "failed",
  subject: "octocat",
  started_at: "2026-05-25T00:03:00Z",
  finished_at: "2026-05-25T00:03:01Z",
  metrics: {
    failed: 1,
    user_sync_in_progress: 1,
    lease_conflicts: 1,
  },
  last_error: "user sync already in progress; wait for current run to finish",
};

const zeroDiscoveryWithHistoryRun = {
  id: "run_zero_discovery_1",
  run_type: "user",
  status: "partial",
  subject: "octocat",
  started_at: "2026-05-25T00:04:00Z",
  finished_at: "2026-05-25T00:04:12Z",
  metrics: {
    authored_pull_request_discovery_empty: 1,
    authored_pull_request_persisted_existing: 1,
    authored_pull_request_persisted_known: 12,
  },
};

const syncedTargetsRun = {
  id: "run_synced_targets_1",
  run_type: "user",
  status: "completed",
  subject: "octocat",
  started_at: "2026-05-25T00:06:00Z",
  finished_at: "2026-05-25T00:06:08Z",
  metrics: {
    authored_pull_requests_selected: 7,
  },
};

const appInstallationRequiredRun = {
  id: "run_app_required_1",
  run_type: "user",
  status: "failed",
  subject: "octocat",
  started_at: "2026-05-25T00:08:00Z",
  finished_at: "2026-05-25T00:08:04Z",
  metrics: {
    failed: 1,
    auth_errors: 1,
    app_installation_required: 1,
  },
};

const supersededActiveRowRun = {
  id: "run_superseded_1",
  run_type: "user",
  status: "failed",
  subject: "octocat",
  started_at: "2026-05-25T00:07:00Z",
  finished_at: "2026-05-25T00:07:02Z",
  last_error: "sync execution was superseded by a newer terminal run for the same correlation",
};

describe("SyncRunActivityPanel", () => {
  it("keeps filter reset flow consistent with minimal controls", () => {
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

    expect(screen.queryByText("View: All")).toBeNull();
    expect(screen.queryByText(/Active:/)).toBeNull();
    expect(screen.queryByText(/Search:/)).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: "Search sync runs" }), {
      target: { value: "missing-run" },
    });

    expect(screen.getAllByRole("button", { name: "Reset filters" }).length).toBeGreaterThan(0);
    expect(screen.getByText("No sync runs match this filter.")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: "Reset filters" })[0]);

    const searchBox = screen.getByRole("textbox", { name: "Search sync runs" }) as HTMLInputElement;
    expect(searchBox.value).toBe("");
    expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull();
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
    expect(screen.getAllByText("Partial").length).toBeGreaterThan(0);
  });

  it("surfaces failure telemetry for failed runs", () => {
    render(
      <SyncRunActivityPanel
        runs={[failedRun]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("Failures 1 · Timeout 1")).toBeTruthy();
    expect(screen.getByText(/Last error:/)).toBeTruthy();
  });

  it("surfaces user-sync contention telemetry when conflicts are recorded", () => {
    render(
      <SyncRunActivityPanel
        runs={[conflictRun]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("Failures 1 · In-progress conflicts 1")).toBeTruthy();
  });

  it("shows deterministic zero-discovery insight when history exists", () => {
    render(
      <SyncRunActivityPanel
        runs={[zeroDiscoveryWithHistoryRun]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        "No authored PRs were discovered in this run even though historical PR evidence already exists. Reconnect GitHub if scope changed, then retry.",
      ),
    ).toBeTruthy();
  });

  it("shows authored target count insight for completed runs", () => {
    render(
      <SyncRunActivityPanel
        runs={[syncedTargetsRun]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("Synced 7 authored PR targets in this run.")).toBeTruthy();
  });

  it("shows app-installation-required insight and metric summary", () => {
    render(
      <SyncRunActivityPanel
        runs={[appInstallationRequiredRun]}
        lastUpdatedAt="2026-05-25T00:09:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("Failures 1")).toBeTruthy();
    expect(
      screen.getByText(
        "GitHub App installation is required for PR sync. Install GitRank GitHub App for your account and retry sync.",
      ),
    ).toBeTruthy();
  });

  it("shows explicit app-token auth telemetry when strict installation auth is recorded", () => {
    render(
      <SyncRunActivityPanel
        runs={[
          {
            ...sampleRun,
            id: "run_auth_metric_1",
            metrics: {
              auth_installation_client: 1,
              pull_requests: 1,
              fetched_pull_requests: 1,
            },
          },
        ]}
        lastUpdatedAt="2026-05-25T00:05:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(screen.getByText("Auth App token · PRs 1/1")).toBeTruthy();
  });

  it("shows superseded-correlation insight for stale in-progress rows", () => {
    render(
      <SyncRunActivityPanel
        runs={[supersededActiveRowRun]}
        lastUpdatedAt="2026-05-25T00:08:00Z"
        isLoading={false}
        isRefreshing={false}
        isError={false}
        onRefresh={() => undefined}
      />,
    );

    expect(
      screen.getByText(
        /A stale in-progress run row was superseded by a newer terminal run/,
      ),
    ).toBeTruthy();
  });
});
