"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  analyticsTarget,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  analyticsTarget?: string;
}) {
  const sentEventRef = useRef(false);

  useEffect(() => {
    if (sentEventRef.current || !analyticsTarget) {
      return;
    }
    sentEventRef.current = true;
    void emitAnalyticsEvent({
      eventName: "empty_state.viewed",
      source: "frontend",
      target: analyticsTarget,
      status: "success",
    });
  }, [analyticsTarget]);

  return (
    <GlowCard className="cyber-sheen flex flex-col items-start gap-4 border-dashed border-primary/24">
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-sm font-semibold text-primary">
        <Sparkles className="h-4 w-4" />
        No live data yet
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="max-w-xl text-sm text-slate-100">{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
      {actionLabel && !actionHref && onAction ? (
        <Button onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </GlowCard>
  );
}
