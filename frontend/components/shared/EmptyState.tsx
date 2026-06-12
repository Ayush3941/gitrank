"use client";

import { Inbox } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function EmptyState({
  title,
  description,
  eyebrow = "Evidence pending",
  actionLabel,
  actionHref,
  onAction,
  analyticsTarget,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  analyticsTarget?: string;
}) {
  const sentEventRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

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
    <GlowCard
      role="region"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="cyber-sheen flex flex-col items-start gap-4 border-dashed border-primary/24"
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/12 px-3 py-1.5 text-sm font-semibold text-primary">
        <Inbox className="h-4 w-4" aria-hidden="true" />
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2 id={titleId} className="text-xl font-semibold text-white">{title}</h2>
        <p id={descriptionId} className="max-w-xl text-sm text-muted">{description}</p>
      </div>
      {actionLabel ? (
        <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actionLabel && actionHref ? (
            <Button asChild className="w-full justify-center sm:w-auto">
              <IntentPrefetchLink href={actionHref}>{actionLabel}</IntentPrefetchLink>
            </Button>
          ) : null}
          {actionLabel && !actionHref && onAction ? (
            <Button onClick={onAction} className="w-full justify-center sm:w-auto">
              {actionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </GlowCard>
  );
}
