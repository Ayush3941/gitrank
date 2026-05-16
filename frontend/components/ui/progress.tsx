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
  return (
    <ProgressPrimitive.Root
      className={cn("neon-track relative h-3 overflow-hidden rounded-full", className)}
      value={value}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-primary via-primary-2 to-success shadow-[0_0_18px_rgb(34_226_255_/_0.32)]",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
