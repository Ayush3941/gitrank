import type { ReactNode } from "react";
import { GlowCard } from "@/components/shared/GlowCard";

export function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <GlowCard className="cyber-sheen space-y-3">
      <div className="flex items-center justify-between text-muted">
        <span className="text-sm">{label}</span>
        <span className="hud-pill rounded-2xl p-2">{icon}</span>
      </div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <p className="text-sm text-muted">{detail}</p>
    </GlowCard>
  );
}
