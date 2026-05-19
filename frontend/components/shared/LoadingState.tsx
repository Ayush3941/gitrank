"use client";

import { Loader2 } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";

export function LoadingState({ message }: { message: string }) {
  return (
    <GlowCard className="space-y-4" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
      <span className="sr-only">Loading. {message}</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold">
          <Loader2 className="h-4 w-4" />
          Loading snapshot
        </span>
      </div>
      <p className="text-base text-white">{message}</p>
      <p className="text-sm text-muted">
        Reading contribution evidence, validating score signals, and refreshing the latest profile snapshot.
      </p>
      <div className="space-y-2">
        <div className="neon-skeleton h-2 w-full rounded-full" />
        <div className="neon-skeleton h-2 w-2/3 rounded-full" />
      </div>
    </GlowCard>
  );
}
