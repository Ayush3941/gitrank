import { buildStaleSyncNotice } from "@/lib/presentation/stale-sync-notice";
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
  return buildStaleSyncNotice({
    syncState,
    refreshedAt,
    latestSyncOutcome,
    snapshotLabel: "Profile",
    partialFallback:
      "Profile refreshed, but scored PR evidence is still incomplete. Keep the page open or retry sync.",
    staleFallback:
      "Latest verified data remains visible while sync runs.",
  });
}
