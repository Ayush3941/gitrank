import { describe, expect, it } from "vitest";
import { describeSyncRunOutcome } from "@/features/settings/lib/sync-run-diagnostics";
import type { ApiSyncRunRecord } from "@/lib/api/account-api";

function run(metrics?: Record<string, number>): ApiSyncRunRecord {
  return {
    id: "run_1",
    run_type: "user",
    status: "completed",
    subject: "octocat",
    started_at: "2026-05-25T00:00:00Z",
    finished_at: "2026-05-25T00:00:04Z",
    metrics,
  };
}

describe("describeSyncRunOutcome", () => {
  it("returns zero-discovery-with-history when marker is present", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_request_zero_discovery_with_history: 1,
      }),
    );
    expect(outcome.code).toBe("zero_discovery_with_history");
  });

  it("returns scope-limited when auth scope is limited", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_request_scope_limited: 1,
      }),
    );
    expect(outcome.code).toBe("scope_limited");
  });

  it("returns search-limited when search is incomplete", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_request_search_incomplete: 1,
      }),
    );
    expect(outcome.code).toBe("search_limited");
  });

  it("returns score-replay-mismatch when replay emits zero events after target selection", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_selected: 5,
        post_sync_score_replay_mismatch: 1,
        post_sync_score_replay_events: 0,
      }),
    );
    expect(outcome.code).toBe("score_replay_mismatch");
    expect(outcome.message).toContain("selected 5 targets");
    expect(outcome.message).toContain("emitted 0 events");
  });

  it("returns synced-targets when authored PRs were selected", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_selected: 4,
      }),
    );
    expect(outcome.code).toBe("synced_targets");
    expect(outcome.message).toContain("Synced 4 authored PR targets");
  });
});
