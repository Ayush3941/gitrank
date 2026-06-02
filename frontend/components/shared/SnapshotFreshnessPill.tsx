import { Clock3 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeDays } from "@/lib/formatters";

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
  const exact = formatDateTime(refreshedAt);
  const machineDateTime = normalizeDateTime(refreshedAt);

  return (
    <span
      className={cn(
        "neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        className,
      )}
      title={`Last refreshed ${exact}`}
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
      <time dateTime={machineDateTime ?? undefined}>{formatRelativeDays(refreshedAt)}</time>
    </span>
  );
}

function normalizeDateTime(value?: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
