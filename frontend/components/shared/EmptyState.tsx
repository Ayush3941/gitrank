import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";

export function EmptyState({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel?: string;
}) {
  return (
    <GlowCard className="cyber-sheen flex flex-col items-start gap-4 border-dashed border-primary/24">
      <div className="hud-pill rounded-3xl p-3 text-primary">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-2">
        <h3 className="neon-title text-xl font-semibold">{title}</h3>
        <p className="max-w-xl text-sm text-muted">{description}</p>
      </div>
      {actionLabel ? <Button variant="secondary">{actionLabel}</Button> : null}
    </GlowCard>
  );
}
