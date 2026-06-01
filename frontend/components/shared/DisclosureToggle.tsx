"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

export function DisclosureToggle({
  id,
  controlsId,
  expanded,
  onToggle,
  collapsedLabel,
  expandedLabel,
}: {
  id: string;
  controlsId: string;
  expanded: boolean;
  onToggle: () => void;
  collapsedLabel: string;
  expandedLabel: string;
}) {
  return (
    <button
      type="button"
      id={id}
      className="focus-ring neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      {expanded ? (
        <>
          {expandedLabel}
          <ChevronUp className="h-3.5 w-3.5" />
        </>
      ) : (
        <>
          {collapsedLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </>
      )}
    </button>
  );
}
