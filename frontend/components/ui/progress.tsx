"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/cn";
import { formatPercent, toBoundedPercent } from "@/lib/formatters";

export function Progress({
  className,
  value,
  indicatorClassName,
  "aria-valuetext": ariaValueText,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
}) {
  const safeValue = toBoundedPercent(Number(value ?? 0));

  return (
    <ProgressPrimitive.Root
      {...props}
      className={cn("neon-track relative h-3 overflow-hidden rounded-full", className)}
      aria-valuetext={ariaValueText ?? `${formatPercent(safeValue)} complete`}
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
