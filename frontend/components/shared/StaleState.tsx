"use client";

import Link from "next/link";
import { Clock3 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { formatDateTime } from "@/lib/formatters";
import type { RefreshFeedback } from "@/lib/refresh-feedback";
import { sanitizeUserFacingError } from "@/lib/ui-error-messages";

export function StaleState({
  message,
  reasonMessage,
  updatedAt,
  actionLabel = "Open sync settings",
  actionHref = "/dashboard/settings",
  refreshLabel = "Refresh",
  onRefresh,
  isRefreshing = false,
  analyticsTarget,
}: {
  message: string;
  reasonMessage?: string;
  updatedAt?: string;
  actionLabel?: string;
  actionHref?: string;
  refreshLabel?: string;
  onRefresh?: () => void | Promise<void | RefreshFeedback> | RefreshFeedback;
  isRefreshing?: boolean;
  analyticsTarget?: string;
}) {
  const sentEventRef = useRef(false);
  const [refreshFeedback, setRefreshFeedback] = useState<RefreshFeedback | null>(null);
  const [isRefreshPending, setIsRefreshPending] = useState(false);

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
  const refreshBusy = isRefreshing || isRefreshPending;

  async function handleRefresh() {
    if (!onRefresh || refreshBusy) {
      return;
    }
    setRefreshFeedback(null);
    setIsRefreshPending(true);
    try {
      const outcome = await onRefresh();
      if (outcome && typeof outcome === "object" && "message" in outcome) {
        setRefreshFeedback({
          message: outcome.message,
          tone: outcome.tone ?? "success",
        });
      } else {
        setRefreshFeedback({
          tone: "success",
          message: "Refresh requested. This view updates automatically when sync completes.",
        });
      }
    } catch (error) {
      const sanitized = sanitizeUserFacingError((error as Error | null)?.message, "stale-refresh");
      setRefreshFeedback({
        tone: "error",
        message: sanitized || "Refresh request failed for now. Retry shortly.",
      });
    } finally {
      setIsRefreshPending(false);
    }
  }

  return (
    <GlowCard className="cyber-sheen space-y-3 border border-amber-400/22 bg-amber-400/8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-400/14 px-2.5 py-1 text-sm font-semibold text-amber-100">
            <Clock3 className="h-4 w-4" />
            Data is stale
          </div>
          <div className="space-y-1">
            <p className="font-medium text-amber-100">{message}</p>
            <p className="text-sm text-amber-100">Latest verified data stays visible while sync refreshes.</p>
            {reasonMessage ? <p className="text-sm text-amber-100">{reasonMessage}</p> : null}
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
              onClick={() => {
                void handleRefresh();
              }}
              disabled={refreshBusy}
              aria-busy={refreshBusy || undefined}
            >
              {refreshBusy ? "Refreshing..." : refreshLabel}
            </Button>
          ) : null}
          <Button asChild variant="secondary">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        </div>
      </div>
      {refreshFeedback ? (
        <p
          role="status"
          aria-live="polite"
          className={
            refreshFeedback.tone === "error"
              ? "text-sm text-rose-200"
              : refreshFeedback.tone === "warning"
                ? "text-sm text-amber-100"
                : "text-sm text-emerald-100"
          }
        >
          {refreshFeedback.message}
        </p>
      ) : null}
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
