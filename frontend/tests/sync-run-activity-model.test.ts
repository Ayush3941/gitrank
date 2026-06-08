import { describe, expect, it } from "vitest";
import {
  buildSyncRunActivityModel,
  sanitizeSyncRunErrorMessage,
  summarizeRunMetrics,
  syncRunLabel,
} from "@/features/settings/lib/sync-run-activity-model";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";

describe("buildSyncRunActivityModel", () => {
  it("builds searchable rows, status counts, health summary, and filtered results", () => {
    const completedRun = buildRun({
      id: "completed-1",
      status: "completed",
      requested_repository: "octo/gitrank",
      subject: "octo/gitrank#42",
      metrics: {
        pull_requests: 3,
        fetched_pull_requests: 5,
        reviews: 2,
        fetched_reviews: 4,
        reviews_skipped: 1,
      },
    });
    const partialRun = buildRun({
      id: "partial-1",
      status: "completed",
      subject: "octocat",
      metrics: {
        authored_pull_request_backfill_incomplete: 1,
      },
    });
    const failedRun = buildRun({
      id: "failed-1",
      status: "failed",
      requested_user: "octocat",
      metrics: {
        failed: 1,
        timeout_errors: 1,
      },
      last_error: "context deadline exceeded while awaiting headers",
    });

    const model = buildSyncRunActivityModel({
      runs: [completedRun, partialRun, failedRun],
      search: "timeout",
      deferredSearch: "timeout",
      statusFilter: "Failed",
    });

    expect(model.rows.map((row) => row.label)).toEqual([
      "octo/gitrank",
      "octocat",
      "@octocat",
    ]);
    expect(model.rows[0]?.metricsSummary).toBe("PRs 3/5 · Reviews 2/4 · Skipped 1");
    expect(model.rows[1]?.uiStatus).toBe("Partial");
    expect(model.rows[2]?.safeLastError).toContain("GitHub timed out");
    expect(model.statusCounts).toMatchObject({
      all: 3,
      completed: 1,
      partial: 1,
      failed: 1,
    });
    expect(model.filteredRows.map((row) => row.id)).toEqual(["failed-1"]);
    expect(model.healthSummaryLabel).toBe("Sync health: attention needed");
    expect(model.canReset).toBe(true);
  });

  it("surfaces summary insight only when latest actionable outcome differs from top row detail", () => {
    const topCompletedRun = buildRun({
      id: "completed-1",
      status: "completed",
      metrics: {
        authored_pull_requests_selected: 4,
      },
    });
    const olderAppInstallFailure = buildRun({
      id: "failed-older",
      status: "failed",
      metrics: {
        failed: 1,
        auth_errors: 1,
        app_installation_required: 1,
      },
    });

    const model = buildSyncRunActivityModel({
      runs: [topCompletedRun, olderAppInstallFailure],
      search: "",
      deferredSearch: "",
      statusFilter: "All",
    });

    expect(model.rows[0]?.outcomeInsight).toBe("Synced 4 authored PR targets in this run.");
    expect(model.summaryInsight).toMatch(/GitHub App installation is required/);
    expect(model.healthSummaryLabel).toBe("Sync health: attention needed");
  });
});

describe("sync run activity helpers", () => {
  it("summarizes auth, persistence, failures, refresh, and suffix metrics", () => {
    expect(
      summarizeRunMetrics({
        auth_installation_client: 1,
        persisted_pull_requests: 2,
        fetched_pull_requests: 4,
        persisted_issues: 1,
        failed: 1,
        timeout_errors: 2,
        post_sync_refresh_ok: 1,
        file_fetch_errors: 3,
      }),
    ).toBe(
      "Auth App token · PRs 2/4 · Issues 1 · Failures 1 · Timeout 2 · Refresh settled · Fetch errors 3",
    );
  });

  it("uses repository, requested user, subject, then fallback labels", () => {
    expect(syncRunLabel(buildRun({ requested_repository: "owner/repo" }))).toBe("owner/repo");
    expect(syncRunLabel(buildRun({ requested_user: "octocat" }))).toBe("@octocat");
    expect(syncRunLabel(buildRun({ subject: "sync subject" }))).toBe("sync subject");
    expect(syncRunLabel(buildRun({ subject: "" }))).toBe("Sync run");
  });

  it("normalizes timeout errors without leaking raw transport wording", () => {
    expect(
      sanitizeSyncRunErrorMessage("Client.Timeout exceeded while awaiting headers"),
    ).toBe(
      "GitHub timed out while fetching some metadata. Existing evidence was kept and a background retry can fill remaining gaps.",
    );
  });
});

function buildRun(overrides: Partial<ApiSyncRunRecord> = {}): ApiSyncRunRecord {
  return {
    id: overrides.id ?? "run-1",
    run_type: overrides.run_type ?? "user",
    status: overrides.status ?? "completed",
    subject: overrides.subject ?? "octocat",
    started_at: overrides.started_at ?? "2026-05-25T00:00:00Z",
    finished_at: overrides.finished_at ?? "2026-05-25T00:00:10Z",
    requested_repository: overrides.requested_repository,
    requested_user: overrides.requested_user,
    requested_by_subject: overrides.requested_by_subject,
    requested_by_github_login: overrides.requested_by_github_login,
    correlation_id: overrides.correlation_id,
    metrics: overrides.metrics,
    last_error: overrides.last_error,
  };
}
