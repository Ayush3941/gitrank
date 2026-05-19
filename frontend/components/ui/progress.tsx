"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/cn";

export function Progress({
  className,
  value,
  indicatorClassName,
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  const normalizedValue = Number.isFinite(value ?? 0) ? Number(value ?? 0) : 0;
  const safeValue = Math.max(0, Math.min(100, normalizedValue));

  return (
    <ProgressPrimitive.Root
      className={cn("neon-track relative h-3 overflow-hidden rounded-full", className)}
      value={safeValue}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-primary via-primary-2 to-success shadow-[0_0_12px_rgb(34_226_255_/_0.24)]",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
