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

function runFor(
  runType: string,
  status: string,
  metrics?: Record<string, number>,
): ApiSyncRunRecord {
  return {
    ...run(metrics),
    run_type: runType,
    status,
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

  it("returns repository-partial-subfetch for repository partial runs with skipped sub-fetch metrics", () => {
    const outcome = describeSyncRunOutcome(
      runFor("repository", "partial", {
        pull_requests_skipped: 1,
      }),
    );
    expect(outcome.code).toBe("repository_partial_subfetch");
    expect(outcome.message).toContain("Repository sync completed with partial evidence");
  });

  it("returns pull-request-partial-subfetch for PR surface partial runs with degraded fetch metrics", () => {
    const outcome = describeSyncRunOutcome(
      runFor("pull_request", "partial", {
        pull_request_files_fetch_errors: 1,
      }),
    );
    expect(outcome.code).toBe("pull_request_partial_subfetch");
    expect(outcome.message).toContain("PR surface sync completed with partial evidence");
  });

  it("returns installation-partial-child for installation partial runs with child partial metrics", () => {
    const outcome = describeSyncRunOutcome(
      runFor("installation", "partial", {
        repository_sync_partial: 2,
      }),
    );
    expect(outcome.code).toBe("installation_partial_child");
    expect(outcome.message).toContain("repository child sync runs were partial");
  });

  it("returns generic-partial when status is partial without specific metrics", () => {
    const outcome = describeSyncRunOutcome(
      runFor("repository", "partial"),
    );
    expect(outcome.code).toBe("generic_partial");
    expect(outcome.message).toContain("partial evidence");
  });

  it("returns unsupported-api-version when backend metrics flag unsupported API version", () => {
    const outcome = describeSyncRunOutcome(
      run({
        unsupported_api_version: 1,
      }),
    );
    expect(outcome.code).toBe("unsupported_api_version");
    expect(outcome.message).toContain("GITHUB_API_VERSION");
  });

  it("returns app-installation-required when backend requires app installation for user sync", () => {
    const outcome = describeSyncRunOutcome(
      run({
        app_installation_required: 1,
      }),
    );
    expect(outcome.code).toBe("app_installation_required");
    expect(outcome.message).toContain("GitHub App installation is required");
  });

  it("returns app-installation-unavailable when app token minting fails", () => {
    const outcome = describeSyncRunOutcome(
      run({
        app_installation_unavailable: 1,
      }),
    );
    expect(outcome.code).toBe("app_installation_unavailable");
    expect(outcome.message).toContain("installation token is unavailable");
  });

  it("returns app-installation-required from last_error when metrics are missing", () => {
    const outcome = describeSyncRunOutcome({
      ...run(undefined),
      status: "failed",
      last_error:
        "github-ingestor user sync failed [github_app_installation_required]: install app first",
    });
    expect(outcome.code).toBe("app_installation_required");
    expect(outcome.message).toContain("installation is required");
  });

  it("returns sync-config-unavailable from sync_config_unavailable last_error", () => {
    const outcome = describeSyncRunOutcome({
      ...run(undefined),
      status: "failed",
      last_error:
        "github-ingestor user sync failed [sync_config_unavailable]: github app credentials missing",
    });
    expect(outcome.code).toBe("sync_config_unavailable");
    expect(outcome.message).toContain("config is incomplete");
    expect(outcome.message).toContain("GITHUB_APP_*");
  });

  it("returns user-sync-actor-mismatch from last_error when user identity guard fails", () => {
    const outcome = describeSyncRunOutcome({
      ...run(undefined),
      status: "failed",
      last_error:
        "github-ingestor user sync failed [user_sync_actor_mismatch]: requested user must match authenticated github login for user sync",
    });
    expect(outcome.code).toBe("user_sync_actor_mismatch");
    expect(outcome.message).toContain("does not match");
  });

  it("returns user-sync-actor-mismatch when backend metrics include mismatch marker", () => {
    const outcome = describeSyncRunOutcome(
      run({
        user_sync_actor_mismatch: 1,
      }),
    );
    expect(outcome.code).toBe("user_sync_actor_mismatch");
    expect(outcome.message).toContain("Reconnect GitHub");
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

  it("returns selected-unmerged-only when selected targets are all unmerged and replay emits zero events", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_selected: 4,
        authored_pull_requests_selected_merged: 0,
        authored_pull_requests_selected_unmerged: 4,
        post_sync_score_replay_events: 0,
      }),
    );
    expect(outcome.code).toBe("selected_unmerged_only");
    expect(outcome.message).toContain("all are currently unmerged");
  });

  it("returns selected-unmerged-only when unmerged-only marker is present", () => {
    const outcome = describeSyncRunOutcome(
      run({
        authored_pull_requests_selected_unmerged_only: 1,
      }),
    );
    expect(outcome.code).toBe("selected_unmerged_only");
    expect(outcome.message).toContain("currently unmerged");
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
