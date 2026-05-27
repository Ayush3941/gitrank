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
    expect(feedback.message).toContain("Refresh started");
  });
});
