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
    title: "No evidence synced yet",
    detail: "GitRank has not imported your contribution history. Connect and keep this session open to let background sync complete.",
    actionLabel: "Open account settings",
    actionHref: "/dashboard/settings",
    toneClassName: "border-primary/28",
    icon: Clock3,
  },
  syncing: {
    title: "Background sync in progress",
    detail: "Evidence import is running. Contribution cards and score explanations will fill in automatically as records persist.",
    actionLabel: "Watch contribution window",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-cyan-300/35",
    icon: RefreshCw,
  },
  partially_synced: {
    title: "Partial evidence available",
    detail: "Some repositories or PR metadata are still pending. Current profile values are usable but may not be complete yet.",
    actionLabel: "Inspect contribution evidence",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-amber-300/35",
    icon: AlertTriangle,
  },
  synced: {
    title: "Evidence is up to date",
    detail: "Your dashboard is reading from the latest verified sync snapshot. New activity will be picked up by background refresh.",
    actionLabel: "Open contribution cards",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-emerald-300/34",
    icon: CheckCircle2,
  },
  stale: {
    title: "Snapshot is stale",
    detail: "Current score and timeline may lag behind recent GitHub activity. Keep this session active or reconnect if stale persists.",
    actionLabel: "Review sync health",
    actionHref: "/dashboard/settings",
    toneClassName: "border-amber-300/35",
    icon: Clock3,
  },
  failed: {
    title: "Sync failed",
    detail: "GitHub sync returned an error. Reconnect the account and retry from settings to restore full contribution evidence.",
    actionLabel: "Recover account link",
    actionHref: "/dashboard/settings",
    toneClassName: "border-rose-300/40",
    icon: ShieldAlert,
  },
  rate_limited: {
    title: "GitHub rate limit reached",
    detail: "GitRank is temporarily throttled by GitHub. Existing snapshot remains visible while automatic retries back off.",
    actionLabel: "View current contribution scope",
    actionHref: "/dashboard/contributions",
    toneClassName: "border-violet-300/35",
    icon: WifiOff,
  },
};

export function syncStateGuideCopy(state: SyncState): SyncStateGuideCopy {
  return SYNC_STATE_COPY[state];
}

export function SyncStateGuide({
  status,
  className,
}: {
  status: SyncStatus;
  className?: string;
}) {
  const copy = syncStateGuideCopy(status.state);
  const Icon = copy.icon;
  const boundedProgress = Number.isFinite(status.progress)
    ? Math.max(0, Math.min(100, Math.round(status.progress)))
    : null;
  const contextParts: string[] = [`Last synced ${formatRelativeDays(status.lastSyncedAt)}.`];
  if (status.currentStep) {
    contextParts.push(`Current step: ${status.currentStep}.`);
  }
  if (boundedProgress !== null && status.state === "syncing") {
    contextParts.push(`Progress ${boundedProgress}%.`);
  }
  if (status.partialProfileAvailable && status.state !== "partially_synced") {
    contextParts.push("Partial profile data is still available.");
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
          <h3 className="cyber-title text-sm font-semibold text-white">{copy.title}</h3>
          <p className="text-sm leading-6 text-slate-200">{copy.detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-slate-200">{contextParts.join(" ")}</p>
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
