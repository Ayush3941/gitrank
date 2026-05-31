import { formatRelativeDays } from "@/lib/formatters";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";

export type DashboardStaleNotice = {
  message: string;
  reasonMessage?: string;
};

export function buildDashboardStaleNotice(
  syncState: "stale" | "partially_synced",
  refreshedAt: string,
  latestSyncOutcome: SyncRunDiagnostic | null,
): DashboardStaleNotice {
  const syncCode = latestSyncOutcome?.code ?? "none";
  const reasonMessage = latestSyncOutcome?.message?.trim() ? latestSyncOutcome.message.trim() : undefined;
  const installationBlocked =
    syncCode === "app_installation_required" ||
    syncCode === "app_installation_unavailable" ||
    syncCode === "app_runtime_required";

  if (syncState === "partially_synced") {
    if (installationBlocked) {
      return {
        message:
          "Sync is blocked until GitHub App installation access is available for this account.",
        reasonMessage,
      };
    }
    return {
      message:
        "Profile refreshed, but scored PR evidence is still incomplete. Keep the page open or retry sync.",
      reasonMessage,
    };
  }

  if (installationBlocked) {
    return {
      message: `Profile refreshed ${formatRelativeDays(refreshedAt)}, but new PR evidence is blocked until GitHub App access is restored.`,
      reasonMessage,
    };
  }

  return {
    message: `Profile refreshed ${formatRelativeDays(refreshedAt)}. Latest verified data remains visible while sync runs.`,
    reasonMessage,
  };
}
