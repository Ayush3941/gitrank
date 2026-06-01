import { cn } from "@/lib/cn";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import type { SyncState } from "@/types/gitrank";

export function ProfileEvidenceStateChip({
  showFreshness,
  refreshedAt,
  syncState,
  refreshedLabel = "Refreshed",
  pendingLabel = "Evidence pending",
  pendingTitle = "No scored PR evidence has been materialized yet.",
  className,
}: {
  showFreshness: boolean;
  refreshedAt?: string;
  syncState?: SyncState;
  refreshedLabel?: string;
  pendingLabel?: string;
  pendingTitle?: string;
  className?: string;
}) {
  const pendingState = resolvePendingState(syncState, pendingLabel, pendingTitle);

  if (showFreshness) {
    return (
      <SnapshotFreshnessPill
        refreshedAt={refreshedAt}
        label={refreshedLabel}
        className={className}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        pendingState.className,
        className,
      )}
      title={pendingState.title}
    >
      {pendingState.label}
    </span>
  );
}

function resolvePendingState(
  syncState: SyncState | undefined,
  pendingLabel: string,
  pendingTitle: string,
): {
  label: string;
  title: string;
  className: string;
} {
  if (syncState === "syncing") {
    return {
      label: "Syncing evidence",
      title: "GitRank is syncing your latest contribution evidence.",
      className: "neon-chip neon-chip-info",
    };
  }
  if (syncState === "partially_synced") {
    return {
      label: "Partially synced",
      title: "Snapshot exists, but some PR evidence is still pending.",
      className: "neon-chip neon-chip-warning",
    };
  }
  if (syncState === "stale") {
    return {
      label: "Data is stale",
      title: "Profile snapshot is older than the freshness window.",
      className: "neon-chip neon-chip-warning",
    };
  }
  if (syncState === "rate_limited") {
    return {
      label: "Rate limited",
      title: "Rate limits delayed evidence refresh. Retry shortly.",
      className: "neon-chip neon-chip-warning",
    };
  }
  if (syncState === "failed") {
    return {
      label: "Sync failed",
      title: "Latest sync failed. Open settings to retry.",
      className: "border border-rose-300/26 bg-rose-500/12 text-rose-100",
    };
  }
  return {
    label: pendingLabel,
    title: pendingTitle,
    className: "neon-chip neon-chip-muted",
  };
}
