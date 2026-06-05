import { useId } from "react";
import { cn } from "@/lib/cn";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import type { SyncState } from "@/types/gitrank";

export function ProfileEvidenceStateChip({
  showFreshness,
  refreshedAt,
  syncState,
  refreshedLabel = "Refreshed",
  pendingLabel = "Evidence pending",
  pendingDescription = "No scored PR evidence has been materialized yet.",
  className,
}: {
  showFreshness: boolean;
  refreshedAt?: string;
  syncState?: SyncState;
  refreshedLabel?: string;
  pendingLabel?: string;
  pendingDescription?: string;
  className?: string;
}) {
  const descriptionId = useId();
  const pendingState = resolvePendingState(syncState, pendingLabel, pendingDescription);

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
      aria-describedby={descriptionId}
    >
      {pendingState.label}
      <span id={descriptionId} className="sr-only">
        {pendingState.description}
      </span>
    </span>
  );
}

function resolvePendingState(
  syncState: SyncState | undefined,
  pendingLabel: string,
  pendingDescription: string,
): {
  label: string;
  description: string;
  className: string;
} {
  if (syncState === "syncing") {
    return {
      label: "Syncing evidence",
      description: "GitRank is syncing your latest contribution evidence.",
      className: "neon-chip neon-chip-info",
    };
  }
  if (syncState === "partially_synced") {
    return {
      label: "Partially synced",
      description: "Snapshot exists, but some PR evidence is still pending.",
      className: "neon-chip neon-chip-warning",
    };
  }
  if (syncState === "stale") {
    return {
      label: "Data is stale",
      description: "Profile snapshot is older than the freshness window.",
      className: "neon-chip neon-chip-warning",
    };
  }
  if (syncState === "rate_limited") {
    return {
      label: "Rate limited",
      description: "Rate limits delayed evidence refresh. Retry shortly.",
      className: "neon-chip neon-chip-warning",
    };
  }
  if (syncState === "failed") {
    return {
      label: "Sync failed",
      description: "Latest sync failed. Open settings to retry.",
      className: "border border-rose-300/26 bg-rose-500/12 text-rose-100",
    };
  }
  return {
    label: pendingLabel,
    description: pendingDescription,
    className: "neon-chip neon-chip-muted",
  };
}
