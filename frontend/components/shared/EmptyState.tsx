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
  eyebrow = "No data yet",
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  onSecondaryAction,
  analyticsTarget,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  onSecondaryAction?: () => void;
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
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="max-w-xl text-sm text-muted">{description}</p>
      </div>
      {actionLabel || secondaryActionLabel ? (
        <div className="flex flex-col items-start gap-2">
          {actionLabel && actionHref ? (
            <Button asChild>
              <Link href={actionHref} prefetch={false}>{actionLabel}</Link>
            </Button>
          ) : null}
          {actionLabel && !actionHref && onAction ? (
            <Button onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {secondaryActionLabel && secondaryActionHref ? (
            <Link
              href={secondaryActionHref}
              prefetch={false}
              className="focus-ring text-sm font-medium text-cyan-100 underline decoration-cyan-300/70 underline-offset-2 hover:text-cyan-50"
            >
              {secondaryActionLabel}
            </Link>
          ) : null}
          {secondaryActionLabel && !secondaryActionHref && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="focus-ring text-sm font-medium text-cyan-100 underline decoration-cyan-300/70 underline-offset-2 hover:text-cyan-50"
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </GlowCard>
  );
}
