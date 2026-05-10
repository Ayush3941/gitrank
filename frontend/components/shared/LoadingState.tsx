"use client";

import { motion, useReducedMotion } from "motion/react";
import { GlowCard } from "@/components/shared/GlowCard";

export function LoadingState({ message }: { message: string }) {
  const reducedMotion = useReducedMotion();

  return (
    <GlowCard className="space-y-4">
      <motion.div
        animate={reducedMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 1.4, repeat: Number.POSITIVE_INFINITY }}
        className="h-2 w-32 rounded-full bg-primary/60"
      />
      <p className="text-base text-white">{message}</p>
      <p className="text-sm text-muted">
        Reading your open-source history, checking review depth, and rebuilding your skill signal.
      </p>
    </GlowCard>
  );
}
