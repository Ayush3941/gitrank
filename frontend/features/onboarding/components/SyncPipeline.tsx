"use client";

import { LoaderCircle } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";

const steps = [
  "Connecting GitHub",
  "Fetching repositories",
  "Reading merged PRs",
  "Analyzing review depth",
  "Classifying contribution type",
  "Calculating PR intensity",
  "Assigning badges",
  "Building public profile",
];

export function SyncPipeline() {
  return (
    <main className="mx-auto max-w-4xl">
      <GlowCard strong className="space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-[0.3em] text-primary uppercase">Analyzing</p>
          <h1 className="text-4xl font-semibold text-white">Reading your open-source history…</h1>
          <p className="max-w-2xl text-base text-muted">
            GitRank is processing your real GitHub data. Step-level completion percentages are intentionally hidden until live progress telemetry is available.
          </p>
        </div>
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step}
              className="neon-surface flex items-center gap-4 rounded-[1.75rem] px-4 py-4"
            >
              <div className="neon-tile rounded-2xl p-2 text-primary">
                <LoaderCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{step}</p>
                <p className="text-sm text-muted">
                  This stage runs against live data only.
                </p>
              </div>
            </div>
          ))}
        </div>
      </GlowCard>
    </main>
  );
}
