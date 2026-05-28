import { describe, expect, it } from "vitest";
import { hasPartialSyncRunMetrics, metricCount } from "@/lib/sync/sync-run-metrics-policy";

describe("sync-run-metrics-policy", () => {
  it("counts bounded positive metric values", () => {
    expect(metricCount({ a: 2.8, b: 0 }, "a", "b")).toBe(2);
    expect(metricCount({ a: -4, b: 1 }, "a", "b")).toBe(1);
    expect(metricCount({ a: Number.NaN, b: Number.POSITIVE_INFINITY }, "a", "b")).toBe(0);
  });

  it("detects partial sync markers for discovery/backfill/scope/retry states", () => {
    expect(hasPartialSyncRunMetrics({ authored_pull_request_discovery_empty: 1 })).toBe(true);
    expect(hasPartialSyncRunMetrics({ authored_pull_request_backfill_incomplete: 1 })).toBe(true);
    expect(hasPartialSyncRunMetrics({ authored_pull_request_scope_limited: 1 })).toBe(true);
    expect(hasPartialSyncRunMetrics({ authored_pull_requests_retryable: 2 })).toBe(true);
    expect(hasPartialSyncRunMetrics({ post_sync_score_replay_failed: 1 })).toBe(true);
  });

  it("returns false when no partial marker is present", () => {
    expect(hasPartialSyncRunMetrics({ authored_pull_requests_selected: 9 })).toBe(false);
    expect(hasPartialSyncRunMetrics({})).toBe(false);
    expect(hasPartialSyncRunMetrics(undefined)).toBe(false);
  });
});

