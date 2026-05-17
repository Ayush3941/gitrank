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
  actionLabel = "Open settings",
  actionHref = "/dashboard/settings",
  refreshLabel = "Refresh snapshot",
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
        <Clock3 className="mt-0.5 h-5 w-5 text-amber-100" />
        <div className="space-y-1">
          <p className="font-medium text-amber-50">{message}</p>
          <p className="text-sm text-amber-50/75">
            The latest verified snapshot is still visible while a newer sync path is pending.
          </p>
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
          <Link href={actionHref}>{actionLabel}</Link>
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
