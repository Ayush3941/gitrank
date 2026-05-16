"use client";

import { GlowCard } from "@/components/shared/GlowCard";

export function LoadingState({ message }: { message: string }) {
  return (
    <GlowCard className="space-y-4">
      <div className="h-2 w-32 rounded-full bg-primary/60" />
      <p className="text-base text-white">{message}</p>
      <p className="text-sm text-muted">
        Reading your open-source history, checking review depth, and rebuilding your skill signal.
      </p>
    </GlowCard>
  );
}
