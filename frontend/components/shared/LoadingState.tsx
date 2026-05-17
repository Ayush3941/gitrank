"use client";

import { GlowCard } from "@/components/shared/GlowCard";

export function LoadingState({ message }: { message: string }) {
  return (
    <GlowCard className="space-y-4" role="status" aria-live="polite" aria-atomic="true" aria-busy="true">
      <span className="sr-only">Loading. {message}</span>
      <div className="flex items-center gap-3">
        <div className="neon-skeleton h-2 w-24 rounded-full" />
        <div className="neon-skeleton h-2 w-16 rounded-full" />
      </div>
      <p className="text-base text-white">{message}</p>
      <p className="text-sm text-muted">
        Reading contribution evidence, validating score signals, and refreshing the latest profile snapshot.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="neon-skeleton h-10 rounded-[0.9rem]" />
        <div className="neon-skeleton h-10 rounded-[0.9rem]" />
        <div className="neon-skeleton h-10 rounded-[0.9rem]" />
      </div>
    </GlowCard>
  );
}
