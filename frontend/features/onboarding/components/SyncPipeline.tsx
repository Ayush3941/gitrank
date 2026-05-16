"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
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
            We are building a skill profile from merged PRs, review depth, test evidence, and repository context.
          </p>
        </div>
        <div className="space-y-3">
          {steps.map((step, index) => {
            const done = index < 5;
            const active = index === 5;

            return (
              <div
                key={step}
                className="neon-surface flex items-center gap-4 rounded-[1.75rem] px-4 py-4"
              >
                <div className="neon-tile rounded-2xl p-2 text-primary">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <LoaderCircle className={`h-5 w-5 ${active ? "text-primary" : "text-muted"}`} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{step}</p>
                  <p className="text-sm text-muted">
                    {done
                      ? "Completed with usable contribution evidence."
                      : active
                        ? "Calculating PR intensity and anti-spam multiplier."
                        : "Queued next in the analysis pipeline."}
                  </p>
                </div>
                <p className="text-sm text-muted">{Math.min(100, (index + 1) * 12)}%</p>
              </div>
            );
          })}
        </div>
      </GlowCard>
    </main>
  );
}
