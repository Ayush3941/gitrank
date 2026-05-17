import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeDays } from "@/lib/formatters";
import type { SyncStatus } from "@/types/gitrank";

const statusMap = {
  never_synced: { icon: Clock3, tone: "neon-chip neon-chip-muted text-slate-200", label: "Never synced" },
  syncing: { icon: RefreshCw, tone: "neon-chip neon-chip-info text-cyan-100", label: "Syncing" },
  partially_synced: { icon: AlertTriangle, tone: "neon-chip neon-chip-warning", label: "Partial" },
  synced: { icon: CheckCircle2, tone: "neon-chip neon-chip-success", label: "Synced" },
  stale: { icon: Clock3, tone: "neon-chip neon-chip-warning", label: "Stale" },
  failed: { icon: ShieldAlert, tone: "neon-chip border-rose-400/30 bg-rose-400/14 text-rose-100", label: "Failed" },
  rate_limited: { icon: WifiOff, tone: "neon-chip neon-chip-mythic text-violet-100", label: "Rate limited" },
} as const;

export function SyncStatusPill({
  status,
  className,
}: {
  status: SyncStatus;
  className?: string;
}) {
  const meta = statusMap[status.state];
  const Icon = meta.icon;
  const machineDateTime = normalizeDateTime(status.lastSyncedAt);
  const relative = formatRelativeDays(status.lastSyncedAt);
  const exact = formatDateTime(status.lastSyncedAt);
  const showExact = exact !== "Unknown" && machineDateTime !== null;
  const spokenTime = showExact ? `Exact time ${exact}.` : "";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        meta.tone,
        className,
      )}
      title={showExact ? `Last synced ${exact}` : undefined}
      aria-label={`${meta.label}. Last synced ${relative}. ${spokenTime}`.trim()}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
      <time className="text-current" dateTime={machineDateTime ?? undefined}>
        {relative}
      </time>
      {showExact ? (
        <time className="hidden text-current/90 md:inline" dateTime={machineDateTime}>
          ({exact})
        </time>
      ) : null}
    </div>
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
