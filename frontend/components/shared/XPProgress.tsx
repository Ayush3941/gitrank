"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { formatXp } from "@/lib/formatters";

export function XPProgress({
  current,
  next,
  className,
  label = "Level progress toward next level",
}: {
  current: number;
  next: number;
  className?: string;
  label?: string;
}) {
  const progress = Math.min(100, Math.round((current / next) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      <Progress value={progress} aria-label={label} />
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{progress}% toward next level</span>
        <span>{formatXp(next)} XP target</span>
      </div>
    </div>
  );
}
