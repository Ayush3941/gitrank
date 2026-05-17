"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function ExpandableText({
  text,
  lines = 4,
  className,
  textClassName,
  showMoreLabel = "Show more",
  showLessLabel = "Show less",
  minLengthForToggle = 180,
}: {
  text: string;
  lines?: number;
  className?: string;
  textClassName?: string;
  showMoreLabel?: string;
  showLessLabel?: string;
  minLengthForToggle?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = text.trim().length >= minLengthForToggle;
  const clampStyle = useMemo(
    () =>
      expanded
        ? undefined
        : {
            display: "-webkit-box",
            WebkitLineClamp: `${Math.max(2, lines)}`,
            WebkitBoxOrient: "vertical" as const,
            overflow: "hidden",
          },
    [expanded, lines],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <p className={cn("break-anywhere", textClassName)} style={clampStyle}>
        {text}
      </p>
      {canToggle ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-auto px-0 py-0 text-xs"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          {expanded ? showLessLabel : showMoreLabel}
        </Button>
      ) : null}
    </div>
  );
}
