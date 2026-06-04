"use client";

import { GlowCard } from "@/components/shared/GlowCard";
import { formatLoadingAnnouncement, normalizeLoadingTarget } from "@/lib/presentation/loading-copy";

export function LoadingState({ message }: { message: string }) {
  const loadingTarget = normalizeLoadingTarget(message);

  return (
    <GlowCard variant="loading" className="space-y-3" aria-busy="true">
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {formatLoadingAnnouncement(loadingTarget)}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="neon-chip neon-chip-info inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold">Loading</span>
      </div>
      <p className="text-base text-white">{loadingTarget}</p>
      <div className="space-y-2">
        <div className="neon-skeleton h-2 w-full rounded-full" />
        <div className="neon-skeleton h-2 w-2/3 rounded-full" />
      </div>
    </GlowCard>
  );
}
