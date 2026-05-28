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
  it("returns superseded-active-row from deterministic metric marker", () => {
    const outcome = describeSyncRunOutcome(
      run({
        superseded_by_terminal_correlation: 1,
      }),
    );
    expect(outcome.code).toBe("superseded_active_row");
    expect(outcome.message).toContain("superseded");
  });

  it("returns superseded-active-row when logical-scope supersession metric is present", () => {
    const outcome = describeSyncRunOutcome(
      run({
        superseded_by_terminal_logical_scope: 1,
      }),
    );
    expect(outcome.code).toBe("superseded_active_row");
    expect(outcome.message).toContain("superseded");
  });

  it("returns superseded-active-row when failed row is superseded by terminal correlation", () => {
    const outcome = describeSyncRunOutcome({
      ...run(undefined),
      status: "failed",
      last_error: "sync execution was superseded by a newer terminal run for the same correlation",
    });
    expect(outcome.code).toBe("superseded_active_row");
    expect(outcome.message).toContain("superseded");
  });

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

  it("returns rate-limited-hydration when authored PR hydration is rate limited", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_rate_limited: 1,
      }),
    );
    expect(outcome.code).toBe("rate_limited_hydration");
    expect(outcome.message).toContain("rate limited");
  });

  it("returns auth-hydration when authored PR hydration is blocked by scope/auth", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_not_found: 1,
      }),
    );
    expect(outcome.code).toBe("auth_hydration");
    expect(outcome.message).toContain("scope limits");
  });

  it("returns upstream-hydration when authored PR hydration gets upstream failures", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_upstream_errors: 1,
      }),
    );
    expect(outcome.code).toBe("upstream_hydration");
    expect(outcome.message).toContain("upstream GitHub service errors");
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

  it("returns score-replay-failed when replay execution fails", () => {
    const outcome = describeSyncRunOutcome(
      run({
        post_sync_score_replay_failed: 1,
      }),
    );
    expect(outcome.code).toBe("score_replay_failed");
    expect(outcome.message).toContain("score replay could not run");
  });

  it("returns recent-seed-empty when newest seeded authored PR window is empty", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_request_recent_seed_empty: 1,
      }),
    );
    expect(outcome.code).toBe("recent_seed_empty");
    expect(outcome.message).toContain("newest seeded window");
  });

  it("returns broad-fallback when fallback discovery recovers authored PR targets", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_request_broad_fallback_targets: 3,
      }),
    );
    expect(outcome.code).toBe("broad_fallback");
    expect(outcome.message).toContain("broad authored-PR fallback");
    expect(outcome.message).toContain("3 targets");
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

  it("returns sync-capped-recent when target selection is intentionally bounded", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_selected: 10,
        authored_pull_requests_capped: 1,
      }),
    );
    expect(outcome.code).toBe("sync_capped_recent");
    expect(outcome.message).toContain("newest 10 authored PR targets");
    expect(outcome.message).toContain("backfill");
  });

  it("returns profile-refresh-failed when post-sync profile refresh fails", () => {
    const outcome = describeSyncRunOutcome(
      run({
        post_sync_profile_refresh_failed: 1,
        post_sync_refresh_failed: 1,
      }),
    );
    expect(outcome.code).toBe("profile_refresh_failed");
    expect(outcome.message).toContain("profile refresh failed");
  });

  it("returns pr-reports-backfill-failed when report backfill fails", () => {
    const outcome = describeSyncRunOutcome(
      run({
        post_sync_pr_reports_backfill_failed: 1,
        post_sync_refresh_failed: 1,
      }),
    );
    expect(outcome.code).toBe("pr_reports_backfill_failed");
    expect(outcome.message).toContain("report backfill failed");
  });

  it("returns quests-backfill-failed when quest backfill fails", () => {
    const outcome = describeSyncRunOutcome(
      run({
        post_sync_quests_backfill_failed: 1,
        post_sync_refresh_failed: 1,
      }),
    );
    expect(outcome.code).toBe("quests_backfill_failed");
    expect(outcome.message).toContain("quest backfill failed");
  });
});
