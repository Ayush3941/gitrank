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
  const relative = formatRelativeDays(status.lastSyncedAt);
  const exact = formatDateTime(status.lastSyncedAt);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
        meta.tone,
        className,
      )}
      title={`Last synced ${exact}`}
      aria-label={`${meta.label}. Last synced ${relative}. Exact time ${exact}.`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
      <span className="text-current">{relative}</span>
    </div>
  );
}
