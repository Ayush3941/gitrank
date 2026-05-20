"use client";

import Link from "next/link";
import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

type RouteErrorAction = {
  label: string;
  href: string;
  variant?: "default" | "secondary" | "ghost" | "danger";
};

export function RouteErrorCard({
  eyebrow,
  title,
  description,
  retryLabel = "Retry route",
  actions,
  analyticsTarget,
  errorDigest,
  reset,
  unstableRetry,
  centered = false,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  retryLabel?: string;
  actions: RouteErrorAction[];
  analyticsTarget: string;
  errorDigest?: string;
  reset: () => void;
  unstableRetry?: (() => void) | undefined;
  centered?: boolean;
  className?: string;
}) {
  useEffect(() => {
    void emitAnalyticsEvent({
      eventName: "error_state.viewed",
      source: "frontend",
      target: analyticsTarget,
      status: "failure",
    });
  }, [analyticsTarget]);

  function handleRetry() {
    if (typeof unstableRetry === "function") {
      unstableRetry();
      return;
    }
    reset();
  }

  return (
    <GlowCard
      strong
      className={cn(
        "space-y-4",
        centered ? "w-full max-w-2xl text-center" : "",
        className,
      )}
    >
      <p className="text-xs font-medium text-danger">{eyebrow}</p>
      <h1 className="text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
      <p className={cn("text-sm text-muted sm:text-base", centered ? "mx-auto max-w-xl" : "max-w-2xl")}>
        {description}
      </p>
      <div className={cn("flex flex-wrap gap-3", centered ? "items-center justify-center" : "")}>
        <Button variant="secondary" onClick={handleRetry}>
          {retryLabel}
        </Button>
        {actions.map((action) => (
          <Button key={action.href} asChild variant={action.variant ?? "default"}>
            <Link href={action.href} prefetch={false}>{action.label}</Link>
          </Button>
        ))}
      </div>
      {errorDigest ? <p className="text-xs text-slate-400">Error digest: {errorDigest}</p> : null}
    </GlowCard>
  );
}
