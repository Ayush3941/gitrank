import type { ApiSyncExecutionResponse } from "@/lib/api/account-api";
import type { RefreshFeedback } from "@/lib/refresh-feedback";

export function buildUserSyncRefreshFeedback(
  result: ApiSyncExecutionResponse,
): RefreshFeedback {
  const fetched = result.fetched ?? {};
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

  if (
    result.status === "partial" ||
    fetched.authored_pull_request_search_failed === 1 ||
    fetched.authored_pull_requests_retryable > 0
  ) {
    return {
      tone: "warning",
      message:
        "Refresh was only partial. GitHub did not return a complete PR evidence window. Reconnect GitHub and retry.",
    };
  }

  if ((fetched.authored_pull_requests_capped ?? 0) > 0) {
    return {
      tone: "warning",
      message:
        "Refresh completed with a bounded recent PR window. Keep dashboard auto-sync running to backfill older history safely.",
    };
  }

  if (result.status === "queued" || fetched.fallback_queued === 1) {
    return {
      tone: "success",
      message:
        "Refresh queued successfully. New contribution evidence will appear after background sync finishes.",
    };
  }

  return {
    tone: "success",
    message:
      "Refresh started. Keep this page open while GitRank updates your profile snapshot.",
  };
}
