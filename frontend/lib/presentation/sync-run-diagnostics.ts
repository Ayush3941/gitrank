import type { ApiSyncRunRecord } from "@/lib/api/account-api";
import { metricCount } from "@/lib/sync/sync-run-metrics-policy";

export type SyncRunDiagnostic = {
  code:
    | "zero_discovery_with_history"
    | "scope_limited"
    | "oauth_token_required"
    | "oauth_token_malformed"
    | "score_replay_mismatch"
    | "score_replay_failed"
    | "profile_refresh_failed"
    | "pr_reports_backfill_failed"
    | "quests_backfill_failed"
    | "search_limited"
    | "rate_limited_hydration"
    | "auth_hydration"
    | "upstream_hydration"
    | "conflict_hydration"
    | "retryable_or_timeout"
    | "backfill_incomplete"
    | "snapshot_refresh_pending"
    | "recent_seed_empty"
    | "broad_fallback"
    | "discovery_empty"
    | "selected_unmerged_only"
    | "sync_capped_recent"
    | "superseded_active_row"
    | "synced_targets"
    | "none";
  message: string;
};

export function describeSyncRunOutcome(run: ApiSyncRunRecord): SyncRunDiagnostic {
  const metrics = run.metrics;
  if (
    metrics &&
    metricCount(metrics, "superseded_by_terminal_correlation", "superseded_by_terminal_logical_scope") > 0
  ) {
    return {
      code: "superseded_active_row",
      message:
        "A stale in-progress run row was superseded by a newer terminal run for the same sync target.",
    };
  }

  const normalizedLastError = (run.last_error ?? "").toLowerCase();
  if (normalizedLastError.includes("superseded by a newer terminal run")) {
    return {
      code: "superseded_active_row",
      message:
        "A stale in-progress run row was superseded by a newer terminal run for the same sync target.",
    };
  }

  if (!metrics) {
    return {
      code: "none",
      message: "",
    };
  }

  const scopeLimited = metricCount(metrics, "authored_pull_request_scope_limited") > 0;
  const discoveryEmpty = metricCount(metrics, "authored_pull_request_discovery_empty") > 0;
  const persistedExisting = metricCount(metrics, "authored_pull_request_persisted_existing") > 0;
  const zeroDiscoveryWithHistory =
    metricCount(metrics, "authored_pull_request_zero_discovery_with_history") > 0 ||
    (discoveryEmpty && persistedExisting);
  const backfillIncomplete = metricCount(metrics, "authored_pull_request_backfill_incomplete") > 0;
  const searchIncomplete = metricCount(metrics, "authored_pull_request_search_incomplete") > 0;
  const searchOverflow = metricCount(metrics, "authored_pull_request_search_overflow") > 0;
  const retryable = metricCount(metrics, "authored_pull_requests_retryable") > 0;
  const timeout = metricCount(metrics, "authored_pull_requests_timeouts", "fetched_timeout_errors", "timeout_errors") > 0;
  const rateLimitedHydration = metricCount(metrics, "authored_pull_requests_rate_limited") > 0;
  const authHydration = metricCount(metrics, "authored_pull_requests_auth_errors", "authored_pull_requests_not_found") > 0;
  const upstreamHydration = metricCount(metrics, "authored_pull_requests_upstream_errors") > 0;
  const conflictHydration = metricCount(metrics, "authored_pull_requests_conflicts") > 0;
  const snapshotRefreshPending = metricCount(metrics, "post_sync_refresh_failed") > 0;
  const scoreReplayMismatch = metricCount(metrics, "post_sync_score_replay_mismatch") > 0;
  const scoreReplayFailed = metricCount(metrics, "post_sync_score_replay_failed") > 0;
  const profileRefreshFailed = metricCount(metrics, "post_sync_profile_refresh_failed") > 0;
  const reportBackfillFailed = metricCount(metrics, "post_sync_pr_reports_backfill_failed") > 0;
  const questBackfillFailed = metricCount(metrics, "post_sync_quests_backfill_failed") > 0;
  const oauthTokenRequired = metricCount(metrics, "oauth_token_required") > 0;
  const oauthTokenMalformed = metricCount(metrics, "oauth_token_malformed") > 0;
  const recentSeedEmpty = metricCount(metrics, "authored_pull_request_recent_seed_empty") > 0;
  const broadFallbackTargets = metricCount(metrics, "authored_pull_request_broad_fallback_targets");
  const syncCapped = metricCount(metrics, "authored_pull_requests_capped") > 0;
  const scoreReplayEvents = metricCount(metrics, "post_sync_score_replay_events");
  const selectedAuthoredPRs = metricCount(metrics, "authored_pull_requests_selected");
  const selectedMergedPRs = metricCount(metrics, "authored_pull_requests_selected_merged");
  const selectedUnmergedPRs = metricCount(metrics, "authored_pull_requests_selected_unmerged");

  if (zeroDiscoveryWithHistory) {
    return {
      code: "zero_discovery_with_history",
      message:
        "No authored PRs were discovered in this run even though historical PR evidence already exists. Reconnect GitHub if scope changed, then retry.",
    };
  }
  if (scopeLimited) {
    return {
      code: "scope_limited",
      message:
        "GitHub returned limited authorization scope for authored PR discovery. Reconnect GitHub to expand accessible PR evidence.",
    };
  }
  if (oauthTokenRequired) {
    return {
      code: "oauth_token_required",
      message:
        "GitHub OAuth token is missing or expired for this account. Refresh session or reconnect GitHub, then retry sync.",
    };
  }
  if (oauthTokenMalformed) {
    return {
      code: "oauth_token_malformed",
      message:
        "Stored GitHub OAuth token could not be decrypted. Reconnect GitHub to reissue credentials, then retry sync.",
    };
  }
  if (scoreReplayMismatch) {
    const selectedTargets = selectedAuthoredPRs > 0 ? selectedAuthoredPRs : "new";
    return {
      code: "score_replay_mismatch",
      message:
        `Authored PR sync selected ${selectedTargets} target${selectedAuthoredPRs === 1 ? "" : "s"}, but score replay emitted ${scoreReplayEvents} events. Keep auto-sync active and refresh after replay catches up.`,
    };
  }
  if (scoreReplayFailed) {
    return {
      code: "score_replay_failed",
      message:
        "GitHub sync completed, but score replay could not run right now. Existing profile evidence was preserved and will refresh on retry.",
    };
  }
  if (recentSeedEmpty) {
    return {
      code: "recent_seed_empty",
      message:
        "No authored PRs were discovered in the newest seeded window yet. GitRank is still continuing broader bounded discovery.",
    };
  }
  if (broadFallbackTargets > 0) {
    return {
      code: "broad_fallback",
      message:
        `Windowed discovery was empty, so GitRank used a broad authored-PR fallback and recovered ${broadFallbackTargets} target${broadFallbackTargets === 1 ? "" : "s"}.`,
    };
  }
  if (discoveryEmpty) {
    return {
      code: "discovery_empty",
      message: "No authored PRs were discovered for the current sync window yet.",
    };
  }
  if (searchIncomplete || searchOverflow) {
    return {
      code: "search_limited",
      message:
        "GitHub search limits were hit during authored PR discovery. GitRank will continue bounded backfill on later runs.",
    };
  }
  if (rateLimitedHydration) {
    return {
      code: "rate_limited_hydration",
      message:
        "Some authored PR hydration calls were rate limited by GitHub. GitRank kept existing evidence and will retry in later sync runs.",
    };
  }
  if (authHydration) {
    return {
      code: "auth_hydration",
      message:
        "Some authored PR hydration calls were blocked by authorization or scope limits. Reconnect GitHub to restore full PR evidence coverage.",
    };
  }
  if (upstreamHydration) {
    return {
      code: "upstream_hydration",
      message:
        "Some authored PR hydration calls failed due to upstream GitHub service errors. Retry later to complete evidence hydration.",
    };
  }
  if (conflictHydration) {
    return {
      code: "conflict_hydration",
      message:
        "Some authored PR hydration calls returned conflict responses. GitRank preserved current evidence and will continue on later runs.",
    };
  }
  if (retryable || timeout) {
    return {
      code: "retryable_or_timeout",
      message:
        "Some authored PR surfaces were retryable or timed out. Existing evidence was kept and later sync runs can fill missing rows.",
    };
  }
  if (backfillIncomplete) {
    return {
      code: "backfill_incomplete",
      message: "Recent PR evidence is synced. Historical authored PR backfill is still in progress.",
    };
  }
  if (profileRefreshFailed) {
    return {
      code: "profile_refresh_failed",
      message:
        "GitHub sync completed, but profile refresh failed in this run. Retry sync to regenerate the latest dashboard snapshot.",
    };
  }
  if (reportBackfillFailed) {
    return {
      code: "pr_reports_backfill_failed",
      message:
        "GitHub sync completed, but PR report backfill failed in this run. Existing profile data is preserved; retry to refresh battle reports.",
    };
  }
  if (questBackfillFailed) {
    return {
      code: "quests_backfill_failed",
      message:
        "GitHub sync completed, but quest backfill failed in this run. Retry sync to restore quest recommendations from latest evidence.",
    };
  }
  if (snapshotRefreshPending) {
    return {
      code: "snapshot_refresh_pending",
      message: "Sync completed, but profile snapshot refresh is still finishing.",
    };
  }
  if (
    selectedAuthoredPRs > 0 &&
    selectedMergedPRs == 0 &&
    selectedUnmergedPRs == selectedAuthoredPRs &&
    scoreReplayEvents == 0
  ) {
    return {
      code: "selected_unmerged_only",
      message:
        `Synced ${selectedAuthoredPRs} authored PR target${selectedAuthoredPRs === 1 ? "" : "s"}, but all are currently unmerged. XP and score movement start after merge events are observed.`,
    };
  }
  if (syncCapped && selectedAuthoredPRs > 0) {
    return {
      code: "sync_capped_recent",
      message:
        `Synced the newest ${selectedAuthoredPRs} authored PR target${selectedAuthoredPRs === 1 ? "" : "s"} in this bounded run. Older history continues through later backfill runs.`,
    };
  }
  if (selectedAuthoredPRs > 0) {
    return {
      code: "synced_targets",
      message: `Synced ${selectedAuthoredPRs} authored PR target${selectedAuthoredPRs === 1 ? "" : "s"} in this run.`,
    };
  }
  return {
    code: "none",
    message: "",
  };
}

export { metricCount };
