import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function ControlSurface({
  as = "div",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: "div" | "section" }) {
  const Component = as;
  return (
    <Component
      className={cn(
        "neon-surface space-y-3 rounded-[var(--radius-universal)] px-3 py-3 sm:px-4 sm:py-4",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
