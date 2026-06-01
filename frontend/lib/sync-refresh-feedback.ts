import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
import type { RefreshFeedback } from "@/lib/refresh-feedback";
import { canonicalizeSyncRunStatus } from "@/lib/sync/sync-run-status-policy";

export function buildUserSyncRefreshFeedback(
  result: ApiSyncExecutionResponse,
): RefreshFeedback {
  const fetched = result.fetched ?? {};
  const canonicalStatus = canonicalizeSyncRunStatus(result.status);
  const selectedAuthoredPullRequests = Math.max(0, fetched.authored_pull_requests_selected ?? 0);
  const selectedMergedPullRequests = Math.max(0, fetched.authored_pull_requests_selected_merged ?? 0);
  const selectedUnmergedPullRequests = Math.max(0, fetched.authored_pull_requests_selected_unmerged ?? 0);
  const discoveryEmpty = (fetched.authored_pull_request_discovery_empty ?? 0) > 0;
  if (fetched.fallback_queue_unavailable === 1) {
    return {
      tone: "warning",
      message:
        "Refresh could not reach sync services. Keep this page open and retry shortly.",
    };
  }

  if (fetched.post_sync_refresh_failed === 1) {
    return {
      tone: "warning",
      message:
        "GitHub sync completed but snapshot refresh is still finishing. This page will update when it completes.",
    };
  }

  if ((fetched.post_sync_score_replay_mismatch ?? 0) > 0) {
    return {
      tone: "warning",
      message:
        "GitHub PR sync found new targets, but score replay produced no events yet. Keep this page open and refresh after processing catches up.",
    };
  }
  if ((fetched.post_sync_score_replay_expected_zero_unmerged ?? 0) > 0 || (
    selectedAuthoredPullRequests > 0 &&
    selectedMergedPullRequests == 0 &&
    selectedUnmergedPullRequests == selectedAuthoredPullRequests &&
    (fetched.post_sync_score_replay_events ?? 0) == 0
  )) {
    return {
      tone: "warning",
      message:
        "GitHub PR sync completed, but current selected PR targets are still unmerged. XP and score movement begin after merge evidence lands.",
    };
  }

  if ((fetched.authored_pull_request_backfill_incomplete ?? 0) > 0) {
    if ((fetched.authored_pull_request_discovery_empty ?? 0) > 0) {
      return {
        tone: "warning",
        message:
          "Refresh is still backfilling authored PR history. Keep auto-sync running and retry shortly.",
      };
    }
    return {
      tone: "warning",
      message:
        "Refresh captured recent PR evidence. Historical backfill is still in progress.",
    };
  }

  if ((fetched.authored_pull_requests_capped ?? 0) > 0) {
    return {
      tone: "warning",
      message:
        "Refresh completed with a bounded recent PR window. Keep dashboard auto-sync running to backfill older history safely.",
    };
  }

  const broadFallbackTargets = Math.max(0, fetched.authored_pull_request_broad_fallback_targets ?? 0);
  if (broadFallbackTargets > 0) {
    return {
      tone: "success",
      message:
        `Refresh completed via broad fallback discovery and recovered ${broadFallbackTargets} authored PR target${
          broadFallbackTargets === 1 ? "" : "s"
        }.`,
    };
  }

  if ((fetched.authored_pull_requests_rate_limited ?? 0) > 0) {
    return {
      tone: "warning",
      message:
        "Refresh was partially rate limited while hydrating authored PR details. Existing evidence was kept and later runs will retry.",
    };
  }

  if ((fetched.authored_pull_requests_auth_errors ?? 0) > 0 || (fetched.authored_pull_requests_not_found ?? 0) > 0) {
    return {
      tone: "warning",
      message:
        "Refresh was partially blocked by GitHub authorization scope while hydrating authored PR details. Reconnect GitHub and retry.",
    };
  }

  if ((fetched.authored_pull_requests_upstream_errors ?? 0) > 0) {
    return {
      tone: "warning",
      message:
        "Refresh hit upstream GitHub errors while hydrating authored PR details. Retry shortly to complete evidence hydration.",
    };
  }

  if (canonicalStatus === "failed") {
    if ((fetched.app_installation_required ?? 0) > 0) {
      return {
        tone: "warning",
        message:
          "Refresh failed because GitHub App installation is missing. Install GitRank on your account repositories, then retry.",
      };
    }
    if ((fetched.app_installation_unavailable ?? 0) > 0 || (fetched.strict_app_runtime_required ?? 0) > 0) {
      return {
        tone: "warning",
        message:
          "Refresh failed because GitHub App installation credentials are unavailable. Verify App ID/private key and installation, then retry.",
      };
    }
    if ((fetched.user_sync_in_progress ?? 0) > 0 || (fetched.lease_conflicts ?? 0) > 0) {
      return {
        tone: "warning",
        message:
          "Refresh skipped because another user sync is already running. Keep this page open and retry after it finishes.",
      };
    }
    return {
      tone: "warning",
      message:
        "Refresh failed before PR evidence could be hydrated. Reconnect GitHub or verify GitHub App installation, then retry.",
    };
  }

  if (
    canonicalStatus === "partial" ||
    fetched.authored_pull_request_search_failed === 1 ||
    fetched.authored_pull_requests_retryable > 0
  ) {
    if ((fetched.authored_pull_request_scope_limited ?? 0) > 0) {
      return {
        tone: "warning",
        message:
          "GitHub returned limited sync scope for this account. Reconnect GitHub and retry.",
      };
    }
    return {
      tone: "warning",
      message:
        "Refresh was only partial. GitHub did not return a complete PR evidence window. Reconnect GitHub and retry.",
    };
  }

  if (canonicalStatus === "queued" || fetched.fallback_queued === 1) {
    return {
      tone: "success",
      message:
        "Refresh queued successfully. New contribution evidence will appear after background sync finishes.",
    };
  }

  if (canonicalStatus === "completed" && discoveryEmpty && selectedAuthoredPullRequests === 0) {
    return {
      tone: "warning",
      message:
        "Refresh finished but GitHub returned no authored PRs for this window. Reconnect GitHub if scope changed, or retry after GitHub indexing catches up.",
    };
  }

  if (canonicalStatus === "completed" && selectedAuthoredPullRequests > 0) {
    return {
      tone: "success",
      message: `Refresh completed. Synced ${selectedAuthoredPullRequests} authored PR target${
        selectedAuthoredPullRequests === 1 ? "" : "s"
      }.`,
    };
  }

  return {
    tone: "success",
    message:
      "Refresh completed. Keep this page open while GitRank applies the latest snapshot updates.",
  };
}
