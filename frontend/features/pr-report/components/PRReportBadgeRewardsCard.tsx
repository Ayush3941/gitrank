"use client";

import { Award } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import type { PRReportBadgeReward } from "@/features/pr-report/lib/pr-report-presentation";
import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";

export function PRReportBadgeRewardsCard({
  badges,
}: {
  badges: PRReportBadgeReward[];
}) {
  if (!badges.length) {
    return null;
  }

  return (
    <section className="render-opt-section">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white">
          Badge rewards ({badges.length})
        </h2>
        <GlowCard className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            Rewards unlocked
          </div>
          <ul role="list" className="grid gap-3 md:grid-cols-2">
            {badges.map((badge) => {
              const badgeSignals = buildEvidenceSignalChips(badge.evidenceSignals, 3);
              return (
                <li
                  key={badge.key}
                  className="list-none render-opt-card neon-surface rounded-[var(--radius-universal)] p-4"
                >
                  <p className="text-lg font-semibold text-white">{badge.name}</p>
                  {badge.description ? (
                    <p className="mt-2 text-sm text-muted">{badge.description}</p>
                  ) : null}
                  <p className="mt-3 text-xs text-emerald-100">
                    Rule {badge.ruleVersion ?? badge.rule ?? "persisted badge evidence"}
                  </p>
                  {badgeSignals.length ? (
                    <ul role="list" className="mt-3 flex flex-wrap gap-2">
                      {badgeSignals.map((signal) => (
                        <li key={`${badge.key}-${signal}`} className="list-none">
                          <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
                            {signal}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </GlowCard>
      </div>
    </section>
  );
}
