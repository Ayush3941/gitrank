"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function ErrorState({
  title,
  description,
  retryLabel = "Retry sync",
  fallbackLabel = "Use partial data",
  onRetry,
  onFallback,
  fallbackHref = "/dashboard",
  analyticsTarget,
}: {
  title: string;
  description: string;
  retryLabel?: string;
  fallbackLabel?: string;
  onRetry?: () => void;
  onFallback?: () => void;
  fallbackHref?: string;
  analyticsTarget?: string;
}) {
  const sentEventRef = useRef(false);

  useEffect(() => {
    if (sentEventRef.current || !analyticsTarget) {
      return;
    }
    sentEventRef.current = true;
    void emitAnalyticsEvent({
      eventName: "error_state.viewed",
      source: "frontend",
      target: analyticsTarget,
      status: "failure",
    });
  }, [analyticsTarget]);

  function handleRetry() {
    if (onRetry) {
      onRetry();
      return;
    }
    window.location.reload();
  }

  function handleFallback() {
    if (onFallback) {
      onFallback();
      return;
    }
    if (fallbackHref) {
      window.location.assign(fallbackHref);
    }
  }

  return (
    <GlowCard className="cyber-sheen space-y-4 border border-rose-400/24" role="alert" aria-live="assertive">
      <div className="flex items-center gap-3 text-rose-100">
        <AlertTriangle className="h-5 w-5" />
        <h2 className="text-lg font-semibold tracking-wide">{title}</h2>
      </div>
      <p className="text-sm text-muted">{description}</p>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleRetry}>
          <RotateCcw className="h-4 w-4" />
          {retryLabel}
        </Button>
        {fallbackHref ? (
          <Button asChild variant="secondary">
            <Link href={fallbackHref} prefetch={false}>{fallbackLabel}</Link>
          </Button>
        ) : onFallback ? (
          <Button type="button" variant="secondary" onClick={handleFallback}>
            {fallbackLabel}
          </Button>
        ) : null}
      </div>
    </GlowCard>
  );
}
