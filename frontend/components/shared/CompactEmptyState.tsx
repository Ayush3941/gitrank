"use client";

import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { cn } from "@/lib/cn";

type CompactEmptyStateAction = {
  label: string;
  href: string;
  variant?: "secondary" | "ghost";
  prefetchMode?: "intent" | "never";
};

export function CompactEmptyState({
  eyebrow = "Evidence pending",
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: CompactEmptyStateAction;
  secondaryAction?: CompactEmptyStateAction;
  className?: string;
}) {
  const actions = [primaryAction, secondaryAction].filter(
    (action): action is CompactEmptyStateAction => Boolean(action),
  );

  return (
    <div
      role="note"
      className={cn(
        "neon-surface cyber-sheen space-y-3 rounded-[var(--radius-universal)] border border-dashed border-primary/24 px-4 py-3 text-sm",
        className,
      )}
    >
      <div className="inline-flex items-center gap-2 rounded-full border border-primary/24 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
        <Inbox className="h-3.5 w-3.5" aria-hidden="true" />
        {eyebrow}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="max-w-xl text-sm leading-6 text-muted">{description}</p>
      </div>
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action, index) => (
            <Button
              key={`${action.href}-${action.label}`}
              asChild
              size="sm"
              variant={action.variant ?? (index === 0 ? "secondary" : "ghost")}
            >
              <IntentPrefetchLink href={action.href} prefetchMode={action.prefetchMode}>
                {action.label}
              </IntentPrefetchLink>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
