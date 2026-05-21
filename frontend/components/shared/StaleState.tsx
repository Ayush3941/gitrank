"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { formatDateTime } from "@/lib/formatters";

export function StaleState({
  message,
  updatedAt,
  actionLabel = "Open sync settings",
  actionHref = "/dashboard/settings",
  refreshLabel = "Refresh",
  onRefresh,
  isRefreshing = false,
  analyticsTarget,
}: {
  message: string;
  updatedAt?: string;
  actionLabel?: string;
  actionHref?: string;
  refreshLabel?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  analyticsTarget?: string;
}) {
  const sentEventRef = useRef(false);

  useEffect(() => {
    if (sentEventRef.current || !analyticsTarget) {
      return;
    }
    sentEventRef.current = true;
    void emitAnalyticsEvent({
      eventName: "stale_state.viewed",
      source: "frontend",
      target: analyticsTarget,
      status: "success",
    });
  }, [analyticsTarget]);

  const verifiedDateTime = normalizeDateTime(updatedAt);
  const verifiedLabel = updatedAt ? formatDateTime(updatedAt) : "Unknown";

  return (
    <GlowCard className="cyber-sheen flex flex-col gap-3 border border-amber-400/22 bg-amber-400/8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/14 px-2.5 py-1 text-sm font-semibold text-amber-100">
          <Clock3 className="h-4 w-4" />
          Data is stale
        </div>
        <div className="space-y-1">
          <p className="font-medium text-amber-100">{message}</p>
          <p className="text-sm text-amber-100">Latest verified data stays visible while sync refreshes.</p>
          {verifiedDateTime ? (
            <p className="text-xs text-amber-100">
              Last verified at{" "}
              <time dateTime={verifiedDateTime}>
                {verifiedLabel}
              </time>
              .
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {onRefresh ? (
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing || undefined}
          >
            {isRefreshing ? "Refreshing..." : refreshLabel}
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href={actionHref} prefetch={false}>{actionLabel}</Link>
        </Button>
      </div>
    </GlowCard>
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
