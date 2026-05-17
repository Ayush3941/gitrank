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
      <div className="hud-pill rounded-3xl p-3 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-2">
        <h2 className="neon-title text-xl font-semibold">{title}</h2>
        <p className="max-w-xl text-sm text-muted">{description}</p>
      </div>
      {actionLabel && actionHref ? (
        <Button asChild variant="secondary">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
      {actionLabel && !actionHref && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </GlowCard>
  );
}
