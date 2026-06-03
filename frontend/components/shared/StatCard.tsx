import type { ReactNode } from "react";
import { GlowCard } from "@/components/shared/GlowCard";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  detail,
  icon,
  className,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <GlowCard className={cn("cyber-sheen space-y-3", className)}>
      <div className="flex items-center justify-between text-muted">
        <span className="text-sm">{label}</span>
        <span className="hud-pill rounded-[var(--radius-universal)] p-2" aria-hidden="true">{icon}</span>
      </div>
      <div className={cn("numeric-readout text-3xl font-semibold tracking-tight", valueClassName)}>{value}</div>
      {detail ? <p className="text-sm leading-6 text-muted">{detail}</p> : null}
    </GlowCard>
  );
}
