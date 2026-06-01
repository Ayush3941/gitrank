import { describe, expect, it } from "vitest";
import { buildUserSyncRefreshFeedback } from "@/lib/sync-refresh-feedback";
import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";

function execution(overrides?: Partial<ApiSyncExecutionResponse>): ApiSyncExecutionResponse {
  return {
    status: "completed",
    mode: "user",
    correlation_id: "corr",
    started_at: "2026-05-27T00:00:00Z",
    finished_at: "2026-05-27T00:00:05Z",
    fetched: {},
    persisted: {},
    ...overrides,
  };
}

describe("buildUserSyncRefreshFeedback", () => {
  it("returns warning when sync services are unavailable", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({ fetched: { fallback_queue_unavailable: 1 } }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("could not reach sync services");
  });

  it("returns warning for partial sync executions", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({ status: "partial" }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("only partial");
  });

  it("returns progressive backfill copy when history backfill is incomplete", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "partial",
        fetched: {
          authored_pull_request_backfill_incomplete: 1,
          authored_pull_requests_selected: 10,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("Historical backfill is still in progress");
  });

  it("returns reconnect guidance when sync scope is limited", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "partial",
        fetched: {
          authored_pull_request_scope_limited: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("Reconnect GitHub");
  });

  it("returns warning when authored PR window was capped", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({ fetched: { authored_pull_requests_capped: 1 } }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("bounded recent PR window");
  });

  it("returns broad-fallback success copy when fallback discovery recovers targets", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        fetched: {
          authored_pull_request_broad_fallback_targets: 2,
        },
      }),
    );
    expect(feedback.tone).toBe("success");
    expect(feedback.message).toContain("broad fallback");
    expect(feedback.message).toContain("2 authored PR targets");
  });

  it("returns warning when authored PR hydration is rate limited", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        fetched: {
          authored_pull_requests_rate_limited: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("rate limited");
  });

  it("returns warning when authored PR hydration is auth/scope blocked", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        fetched: {
          authored_pull_requests_not_found: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("authorization scope");
  });

  it("returns warning when authored PR hydration has upstream failures", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        fetched: {
          authored_pull_requests_upstream_errors: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("upstream GitHub errors");
  });

  it("returns warning when sync fails due to missing GitHub App installation", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "failed",
        fetched: {
          app_installation_required: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("installation is missing");
  });

  it("returns warning when sync fails due to unavailable GitHub App credentials", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "failed",
        fetched: {
          app_installation_unavailable: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("credentials are unavailable");
  });

  it("returns warning when sync fails because another sync is already running", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "failed",
        fetched: {
          user_sync_in_progress: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("already running");
  });

  it("returns generic warning when sync fails without classified metrics", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "failed",
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("Refresh failed");
  });

  it("returns warning when PR sync targets exist but score replay produced zero events", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "partial",
        fetched: {
          authored_pull_requests_selected: 5,
          post_sync_score_replay_mismatch: 1,
          post_sync_score_replay_events: 0,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("produced no events yet");
  });

  it("returns warning when selected targets are all unmerged and replay is expected to stay zero", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        status: "completed",
        fetched: {
          authored_pull_requests_selected: 4,
          authored_pull_requests_selected_merged: 0,
          authored_pull_requests_selected_unmerged: 4,
          post_sync_score_replay_events: 0,
          post_sync_score_replay_expected_zero_unmerged: 1,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("still unmerged");
  });

  it("returns success when sync is queued", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({ status: "queued" }),
    );
    expect(feedback.tone).toBe("success");
    expect(feedback.message).toContain("queued successfully");
  });

  it("returns default success for completed sync", () => {
    const feedback = buildUserSyncRefreshFeedback(execution());
    expect(feedback.tone).toBe("success");
    expect(feedback.message).toContain("Refresh completed");
  });

  it("returns warning when refresh completes with no authored pull requests discovered", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        fetched: {
          authored_pull_request_discovery_empty: 1,
          authored_pull_requests_selected: 0,
        },
      }),
    );
    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toContain("returned no authored PRs");
  });

  it("returns count-aware success when authored pull requests were synced", () => {
    const feedback = buildUserSyncRefreshFeedback(
      execution({
        fetched: {
          authored_pull_requests_selected: 7,
        },
      }),
    );
    expect(feedback.tone).toBe("success");
    expect(feedback.message).toContain("Synced 7 authored PR targets");
  });
});
