import { metricCount } from "@/lib/sync/sync-run-metrics-policy";

export type AppSyncFailureCode =
  | "app_installation_required"
  | "app_installation_unavailable"
  | "app_runtime_required"
  | "sync_config_unavailable"
  | "user_sync_actor_mismatch";

const APP_SYNC_FAILURE_MESSAGES: Record<AppSyncFailureCode, string> = {
  app_installation_required:
    "GitHub App installation is required for PR sync. Install GitRank GitHub App for your account and retry.",
  app_installation_unavailable:
    "GitHub App installation token is unavailable. Verify GitHub App credentials/private key and installation state, then retry sync.",
  app_runtime_required:
    "Backend sync runtime rejected a non-App extraction path. Restart services and retry so sync runs through GitHub App installation tokens only.",
  sync_config_unavailable:
    "Backend GitHub App sync config is incomplete. Set required GITHUB_APP_* credentials and restart services before retrying sync.",
  user_sync_actor_mismatch:
    "Sync request user does not match the signed-in GitHub account. Reconnect GitHub and retry.",
};

const INSTALL_URL_PATTERN = /(https:\/\/github\.com\/apps\/[A-Za-z0-9-]+\/installations\/new)/i;

export function appSyncFailureMessage(code: AppSyncFailureCode, installURL?: string): string {
  if (code === "app_installation_required" && installURL?.trim()) {
    return `GitHub App installation is required for PR sync. Install GitRank GitHub App and retry: ${installURL.trim()}`;
  }
  return APP_SYNC_FAILURE_MESSAGES[code];
}

export function extractGitHubAppInstallURL(message: string): string {
  const normalized = message.trim();
  if (!normalized) {
    return "";
  }
  const match = normalized.match(INSTALL_URL_PATTERN);
  if (!match || !match[1]) {
    return "";
  }
  return match[1].trim();
}

export function deriveAppSyncFailureCodeFromLastError(
  normalizedLastError: string,
): AppSyncFailureCode | null {
  if (!normalizedLastError) {
    return null;
  }
  if (
    normalizedLastError.includes("github_app_installation_required") ||
    normalizedLastError.includes("app_installation_required")
  ) {
    return "app_installation_required";
  }
  if (
    normalizedLastError.includes("github_app_installation_unavailable") ||
    normalizedLastError.includes("app_installation_unavailable")
  ) {
    return "app_installation_unavailable";
  }
  if (
    normalizedLastError.includes("github_app_runtime_required") ||
    normalizedLastError.includes("strict github app sync runtime is required")
  ) {
    return "app_runtime_required";
  }
  if (normalizedLastError.includes("sync_config_unavailable")) {
    return "sync_config_unavailable";
  }
  if (
    normalizedLastError.includes("user_sync_actor_mismatch") ||
    normalizedLastError.includes("requested user must match authenticated github login for user sync")
  ) {
    return "user_sync_actor_mismatch";
  }
  return null;
}

export function deriveAppSyncFailureCodeFromMetrics(
  metrics: Record<string, number>,
): AppSyncFailureCode | null {
  if (metricCount(metrics, "app_installation_required") > 0) {
    return "app_installation_required";
  }
  if (metricCount(metrics, "app_installation_unavailable") > 0) {
    return "app_installation_unavailable";
  }
  if (metricCount(metrics, "strict_app_runtime_required") > 0) {
    return "app_runtime_required";
  }
  if (metricCount(metrics, "sync_config_unavailable") > 0) {
    return "sync_config_unavailable";
  }
  if (metricCount(metrics, "user_sync_actor_mismatch") > 0) {
    return "user_sync_actor_mismatch";
  }
  return null;
}

export function deriveAppSyncFailureCodeFromApiError(
  message: string,
  code?: string,
): AppSyncFailureCode | null {
  const normalizedMessage = message.trim().toLowerCase();
  if (
    normalizedMessage.includes("github app installation is required for user sync") ||
    code === "github_app_installation_required"
  ) {
    return "app_installation_required";
  }
  if (
    normalizedMessage.includes("github app installation token unavailable for user sync") ||
    code === "github_app_installation_unavailable"
  ) {
    return "app_installation_unavailable";
  }
  if (
    normalizedMessage.includes("strict github app sync runtime is required") ||
    code === "github_app_runtime_required"
  ) {
    return "app_runtime_required";
  }
  if (
    normalizedMessage.includes("sync_config_unavailable") ||
    normalizedMessage.includes("github app sync configuration is incomplete") ||
    code === "sync_config_unavailable"
  ) {
    return "sync_config_unavailable";
  }
  if (
    normalizedMessage.includes("requested user must match authenticated github login for user sync") ||
    code === "user_sync_actor_mismatch"
  ) {
    return "user_sync_actor_mismatch";
  }
  return null;
}
