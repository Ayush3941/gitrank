import { cn } from "@/lib/cn";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";

export function ProfileEvidenceStateChip({
  showFreshness,
  refreshedAt,
  refreshedLabel = "Refreshed",
  pendingLabel = "Evidence pending",
  pendingTitle = "No scored PR evidence has been materialized yet.",
  className,
}: {
  showFreshness: boolean;
  refreshedAt?: string;
  refreshedLabel?: string;
  pendingLabel?: string;
  pendingTitle?: string;
  className?: string;
}) {
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
        "neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        className,
      )}
      title={pendingTitle}
    >
      {pendingLabel}
    </span>
  );
}
