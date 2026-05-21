import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function GlowCard({
  className,
  strong = false,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean; variant?: "default" | "loading" }) {
  const surfaceClasses =
    variant === "loading"
      ? strong
        ? "glass-panel-strong"
        : "glass-panel"
      : strong
        ? "glass-panel-strong cyber-card cyber-frame neon-outline"
        : "glass-panel cyber-frame";
  return (
    <div
      className={cn(
        surfaceClasses,
        "rounded-[var(--radius-card)] p-5 sm:p-6",
        className,
      )}
      {...props}
    />
  );
}
