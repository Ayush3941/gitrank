import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeDays } from "@/lib/formatters";
import type { SyncStatus } from "@/types/gitrank";

const statusMap = {
  never_synced: { icon: Clock3, tone: "text-slate-200 border-white/16 bg-white/8", label: "Never synced" },
  syncing: { icon: RefreshCw, tone: "text-cyan-100 border-cyan-300/34 bg-cyan-300/14", label: "Syncing" },
  partially_synced: { icon: AlertTriangle, tone: "text-amber-100 border-amber-400/30 bg-amber-400/14", label: "Partial" },
  synced: { icon: CheckCircle2, tone: "text-emerald-200 border-emerald-400/32 bg-emerald-400/14", label: "Synced" },
  stale: { icon: Clock3, tone: "text-amber-100 border-amber-400/30 bg-amber-400/14", label: "Stale" },
  failed: { icon: ShieldAlert, tone: "text-rose-100 border-rose-400/30 bg-rose-400/14", label: "Failed" },
  rate_limited: { icon: WifiOff, tone: "text-violet-100 border-violet-400/30 bg-violet-400/14", label: "Rate limited" },
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

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
        meta.tone,
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", status.state === "syncing" && "animate-spin")} />
      <span>{meta.label}</span>
      <span className="text-current/70">{formatRelativeDays(status.lastSyncedAt)}</span>
    </div>
  );
}
