"use client";

import { CalendarClock, Flame, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { StaleState } from "@/components/shared/StaleState";
import { Progress } from "@/components/ui/progress";
import { QuestCard } from "@/features/quests/components/QuestCard";
import { useQuests } from "@/hooks/use-quests";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { Quest } from "@/types/gitrank";

const groups: Array<Quest["cadence"]> = ["Daily", "Weekly", "Long-term", "Skill-based"];

export function QuestsPageClient() {
  const { data, isLoading, isError } = useQuests();
  const quests = data?.quests ?? [];
  const profile = data?.profile;
  const contributionRows = profile?.user.contributions ?? [];
  const streak = summarizeContributionStreak(contributionRows);
  const dayOfYear = dayOfYearUTC(new Date());
  const dayProgress = Math.round((dayOfYear / 365) * 100);
  const questMap = {
    Daily: quests.filter((quest) => quest.cadence === "Daily"),
    Weekly: quests.filter((quest) => quest.cadence === "Weekly"),
    "Long-term": quests.filter((quest) => quest.cadence === "Long-term"),
    "Skill-based": quests.filter((quest) => quest.cadence === "Skill-based"),
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quest board"
        description="Daily, weekly, and long-term missions from the backend quest engine with evidence-aware completion states."
      />
      {data?.staleness?.isStale ? (
        <StaleState
          message={`Quest snapshot refreshed ${formatRelativeDays(
            data.staleness.refreshedAt,
          )}. Live quest signals may lag until the next sync completes.`}
        />
      ) : null}
      {!isLoading && !isError && profile ? (
        <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
          <div className="cyber-hero-overlay pointer-events-none absolute inset-0" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-[0.24em] text-cyan-100 uppercase">
                  <CalendarClock className="h-3.5 w-3.5" />
                  365-day contributor journey
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Day {dayOfYear} of 365</h2>
                <p className="mt-2 text-sm text-slate-200/82">
                  Keep streak momentum and compound high-signal contributions over the full year.
                </p>
              </div>
              <div className="grid gap-2 rounded-2xl border border-fuchsia-300/28 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100">
                <span className="inline-flex items-center gap-2"><Flame className="h-4 w-4" /> Current streak: {streak.currentStreakDays}d</span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Best streak: {streak.bestStreakDays}d</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-200">
                <span>Annual progression</span>
                <span>{dayProgress}%</span>
              </div>
              <Progress value={dayProgress} />
            </div>
          </div>
        </GlowCard>
      ) : null}
      {isLoading ? <LoadingState message="Building your skill tree..." /> : null}
      {isError ? (
        <ErrorState
          title="Quest engine unavailable"
          description="The recommendation system could not finish. Retry or fall back to your last synced quest board."
        />
      ) : null}
      {!isLoading && !isError && quests.length === 0 ? (
        <EmptyState
          title="No quests ready yet."
          description="Leaderboard unlocks after your first verified score, and quests sharpen once the system sees enough meaningful work."
          actionLabel="Sync profile"
        />
      ) : null}
      {!isLoading && !isError && data ? (
        groups.map((group) => {
          const grouped = questMap[group];

          return (
            <section key={group} className="space-y-4">
              <SectionHeader
                title={labelForGroup(group)}
                description={descriptionForGroup(group)}
              />
              {grouped.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  {grouped.map((quest) => (
                    <QuestCard key={quest.id} quest={quest} />
                  ))}
                </div>
              ) : (
                <GlowCard className="neon-surface rounded-[1.5rem] border-dashed border-cyan-300/24 p-4 text-sm text-slate-300">
                  No {labelForGroup(group).toLowerCase()} has been generated by the backend for this profile snapshot yet.
                </GlowCard>
              )}
            </section>
          );
        })
      ) : null}
    </div>
  );
}

function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const current = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((current - start) / 86_400_000);
}

function labelForGroup(group: Quest["cadence"]): string {
  if (group === "Daily") return "Today's Quest";
  if (group === "Weekly") return "Weekly Challenge";
  if (group === "Long-term") return "Long-Term Contributor Journey";
  return "Skill-based Missions";
}

function descriptionForGroup(group: Quest["cadence"]): string {
  if (group === "Daily") return "Short-horizon mission from live backend quest recommendations.";
  if (group === "Weekly") return "Higher impact challenge tuned to contribution quality and consistency.";
  if (group === "Long-term") return "Long arc objective that compounds verified work across snapshots.";
  return "Target weak lanes with precision missions from profile evidence.";
}
