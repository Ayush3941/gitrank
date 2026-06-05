import { formatRelativeDays } from "@/lib/formatters";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";

type StaleSyncState = "stale" | "partially_synced";

export type StaleSyncNotice = {
  message: string;
  reasonMessage?: string;
};

export function buildStaleSyncNotice({
  syncState,
  refreshedAt,
  latestSyncOutcome,
  snapshotLabel,
  partialFallback,
  staleFallback,
}: {
  syncState: StaleSyncState;
  refreshedAt?: string;
  latestSyncOutcome: SyncRunDiagnostic | null;
  snapshotLabel: string;
  partialFallback: string;
  staleFallback: string;
}): StaleSyncNotice {
  const syncCode = latestSyncOutcome?.code ?? "none";
  const reasonMessage = latestSyncOutcome?.message?.trim() ? latestSyncOutcome.message.trim() : undefined;
  const refreshedLabel = refreshedAt ? `refreshed ${formatRelativeDays(refreshedAt)}` : "refresh time is unavailable";
  const appAccessBlocked =
    syncCode === "app_installation_required" ||
    syncCode === "app_installation_unavailable" ||
    syncCode === "app_runtime_required";

  if (syncState === "partially_synced") {
    if (appAccessBlocked) {
      return {
        message:
          "Sync is blocked until GitHub App installation access is available for this account.",
        reasonMessage,
      };
    }
    return {
      message: partialFallback,
      reasonMessage,
    };
  }

  if (appAccessBlocked) {
    return {
      message: `${snapshotLabel} ${refreshedLabel}, but new PR evidence is blocked until GitHub App access is restored.`,
      reasonMessage,
    };
  }

  return {
    message: `${snapshotLabel} ${refreshedLabel}. ${staleFallback}`,
    reasonMessage,
  };
}
