import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatRelativeDays } from "@/lib/formatters";
import type { SyncState, SyncStatus } from "@/types/gitrank";
import { Button } from "@/components/ui/button";

export type SyncStateGuideCopy = {
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  toneClassName: string;
  icon: LucideIcon;
};

const SYNC_STATE_COPY: Record<SyncState, SyncStateGuideCopy> = {
  never_synced: {
    title: "No sync data yet",
    detail: "Connect GitHub and run first sync.",
    actionLabel: "Open sync settings",
    actionHref: "/dashboard/settings",
    toneClassName: "border-primary/28",
    icon: Clock3,
  },
  syncing: {
    title: "Sync in progress",
    detail: "Profile updates will apply automatically.",
    actionLabel: "Open contributions",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-cyan-300/35",
    icon: RefreshCw,
  },
  partially_synced: {
    title: "Partial sync",
    detail: "Some repository or PR metadata is pending.",
    actionLabel: "Open contributions",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-amber-300/35",
    icon: AlertTriangle,
  },
  synced: {
    title: "Synced",
    detail: "Latest verified snapshot loaded.",
    actionLabel: "Open contributions",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-emerald-300/34",
    icon: CheckCircle2,
  },
  stale: {
    title: "Data stale",
    detail: "Score and timeline may lag.",
    actionLabel: "Open sync settings",
    actionHref: "/dashboard/settings",
    toneClassName: "border-amber-300/35",
    icon: Clock3,
  },
  failed: {
    title: "Sync failed",
    detail: "GitHub sync needs recovery.",
    actionLabel: "Reconnect GitHub",
    actionHref: "/dashboard/settings",
    toneClassName: "border-rose-300/40",
    icon: ShieldAlert,
  },
  rate_limited: {
    title: "Rate limited",
    detail: "GitRank will retry automatically.",
    actionLabel: "Open contributions",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-violet-300/35",
    icon: WifiOff,
  },
};

export function syncStateGuideCopy(state: SyncState): SyncStateGuideCopy {
  return SYNC_STATE_COPY[state];
}

export function syncStateGuideState(status: SyncStatus): SyncState {
  if (status.partialProfileAvailable && status.state === "synced") {
    return "partially_synced";
  }
  return status.state;
}

export function shouldShowSyncStateGuide(status: SyncStatus): boolean {
  const state = syncStateGuideState(status);
  return state !== "synced" && state !== "stale";
}

export function SyncStateGuide({
  status,
  className,
}: {
  status: SyncStatus;
  className?: string;
}) {
  const guideState = syncStateGuideState(status);
  const copy = syncStateGuideCopy(guideState);
  const Icon = copy.icon;
  const boundedProgress = Number.isFinite(status.progress)
    ? Math.max(0, Math.min(100, Math.round(status.progress)))
    : null;
  const contextParts: string[] = [`Synced ${formatRelativeDays(status.lastSyncedAt)}.`];
  if (status.currentStep) {
    contextParts.push(`Step: ${status.currentStep}.`);
  }
  if (boundedProgress !== null && status.state === "syncing") {
    contextParts.push(`${boundedProgress}% complete.`);
  }
  if (status.partialProfileAvailable && guideState !== "partially_synced") {
    contextParts.push("Partial data available.");
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        "neon-surface space-y-3 border px-4 py-3",
        copy.toneClassName,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="neon-chip-muted p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="cyber-title text-sm font-semibold text-white">
            {copy.title}
            {boundedProgress !== null && status.state === "syncing" ? ` · ${boundedProgress}%` : ""}
          </h3>
          <p className="text-sm text-muted">{copy.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{contextParts.join(" ")}</p>
        <Button asChild size="sm" variant="secondary">
          <Link href={copy.actionHref}>
            {copy.actionLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </aside>
  );
}
