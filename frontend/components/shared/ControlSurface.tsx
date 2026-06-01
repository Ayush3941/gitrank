import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function ControlSurface({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "neon-surface space-y-3 rounded-[1rem] px-3 py-3 sm:px-4 sm:py-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
