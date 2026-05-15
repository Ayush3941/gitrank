import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/shared/GlowCard";

export function StaleState({ message }: { message: string }) {
  return (
    <GlowCard className="cyber-sheen flex flex-col gap-3 border border-amber-400/22 bg-amber-400/8 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Clock3 className="mt-0.5 h-5 w-5 text-amber-100" />
        <div className="space-y-1">
          <p className="font-medium text-amber-50">{message}</p>
          <p className="text-sm text-amber-50/75">
            The latest verified snapshot is still visible while a newer sync path is pending.
          </p>
        </div>
      </div>
      <Button variant="secondary" disabled>Sync pending</Button>
    </GlowCard>
  );
}
