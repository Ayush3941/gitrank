import { Clock3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { RelativeTime } from "@/components/shared/RelativeTime";

export function SnapshotFreshnessPill({
  refreshedAt,
  label = "Snapshot",
  className,
}: {
  refreshedAt?: string;
  label?: string;
  className?: string;
}) {
  if (!refreshedAt) {
    return null;
  }

  return (
    <span
      className={cn(
        "neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        className,
      )}
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
      <RelativeTime
        value={refreshedAt}
        fallback="Refresh time unavailable"
        exactLabel="Last refreshed"
      />
    </span>
  );
}
