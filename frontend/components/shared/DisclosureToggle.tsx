"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

export function DisclosureToggle({
  id,
  controlsId,
  expanded,
  onToggle,
  collapsedLabel,
  expandedLabel,
  className,
  iconClassName,
}: {
  id: string;
  controlsId: string;
  expanded: boolean;
  onToggle: () => void;
  collapsedLabel: string;
  expandedLabel: string;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      id={id}
      className={cn(
        "focus-ring neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
        className,
      )}
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {expanded ? (
        <>
          {expandedLabel}
          <ChevronUp className={cn("h-3.5 w-3.5", iconClassName)} />
        </>
      ) : (
        <>
          {collapsedLabel}
          <ChevronDown className={cn("h-3.5 w-3.5", iconClassName)} />
        </>
      )}
    </button>
  );
}
