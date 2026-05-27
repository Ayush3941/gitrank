import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
import type { RefreshFeedback } from "@/lib/refresh-feedback";

export function buildUserSyncRefreshFeedback(
  result: ApiSyncExecutionResponse,
): RefreshFeedback {
  const fetched = result.fetched ?? {};
  const selectedAuthoredPullRequests = Math.max(0, fetched.authored_pull_requests_selected ?? 0);
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

  if (
    result.status === "partial" ||
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

  if (result.status === "queued" || fetched.fallback_queued === 1) {
    return {
      tone: "success",
      message:
        "Refresh queued successfully. New contribution evidence will appear after background sync finishes.",
    };
  }

  if (result.status === "completed" && discoveryEmpty && selectedAuthoredPullRequests === 0) {
    return {
      tone: "warning",
      message:
        "Refresh finished but GitHub returned no authored PRs for this window. Reconnect GitHub if scope changed, or retry after GitHub indexing catches up.",
    };
  }

  if (result.status === "completed" && selectedAuthoredPullRequests > 0) {
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
