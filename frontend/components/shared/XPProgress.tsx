"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

export function XPProgress({
  current,
  next,
  className,
}: {
  current: number;
  next: number;
  className?: string;
}) {
  const progress = Math.min(100, Math.round((current / next) * 100));

  return (
    <div className={cn("space-y-2", className)}>
      <Progress value={progress} />
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{progress}% toward next level</span>
        <span>{next.toLocaleString("en-US")} XP target</span>
      </div>
    </div>
  );
}
