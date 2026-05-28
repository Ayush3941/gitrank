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
  const reasonMessage = latestSyncOutcome?.message?.trim() ? latestSyncOutcome.message.trim() : undefined;

  if (syncState === "partially_synced") {
    return {
      message:
        "Profile snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
      reasonMessage,
    };
  }

  return {
    message: `Your GitRank profile was refreshed ${formatRelativeDays(refreshedAt)}.`,
    reasonMessage,
  };
}
