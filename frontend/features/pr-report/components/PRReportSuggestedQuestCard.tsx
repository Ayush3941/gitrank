"use client";

import Link from "next/link";
import { ArrowRight, Swords } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export function PRReportSuggestedQuestCard({
  questId,
  title,
  whyRecommended,
  signals,
}: {
  questId: string;
  title?: string;
  whyRecommended?: string;
  signals: string[];
}) {
  return (
    <section className="render-opt-section">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white">Suggested next quest</h2>
        <GlowCard className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Swords className="h-3.5 w-3.5" aria-hidden="true" />
              Suggested next quest
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {title ?? "Open the live quest board"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {whyRecommended ??
                `Suggested quest key: ${questId}. The quest board resolves this against the latest profile evidence.`}
            </p>
            {signals.length ? (
              <ul role="list" className="mt-3 flex flex-wrap gap-2">
                {signals.map((signal, index) => (
                  <li key={`${questId}-${signal}-${index}`} className="list-none">
                    <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                      {signal}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button asChild variant="secondary">
            <Link href="/dashboard/quests" prefetch={false}>
              Open quests
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </GlowCard>
      </div>
    </section>
  );
}
