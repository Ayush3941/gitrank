import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function GlowCard({
  className,
  strong = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        strong
          ? "glass-panel-strong cyber-card cyber-frame"
          : "glass-panel cyber-card cyber-frame",
        "rounded-[var(--radius-card)] p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
