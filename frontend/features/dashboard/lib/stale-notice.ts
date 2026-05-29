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
        "Profile refreshed, but scored PR evidence is still incomplete. Keep the page open or retry sync.",
      reasonMessage,
    };
  }

  return {
    message: `Profile refreshed ${formatRelativeDays(refreshedAt)}. Latest verified data remains visible while sync runs.`,
    reasonMessage,
  };
}
