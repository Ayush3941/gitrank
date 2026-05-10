import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";

export function ErrorState({
  title,
  description,
  retryLabel = "Retry sync",
  fallbackLabel = "Use partial data",
}: {
  title: string;
  description: string;
  retryLabel?: string;
  fallbackLabel?: string;
}) {
  return (
    <GlowCard className="space-y-4 border border-rose-400/18">
      <div className="flex items-center gap-3 text-rose-100">
        <AlertTriangle className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted">{description}</p>
      <div className="flex flex-wrap gap-3">
        <Button>
          <RotateCcw className="h-4 w-4" />
          {retryLabel}
        </Button>
        <Button variant="secondary">{fallbackLabel}</Button>
      </div>
    </GlowCard>
  );
}
