"use client";

import Link from "next/link";
import { CalendarClock, Flame, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuestCard } from "@/features/quests/components/QuestCard";
import { useQuests } from "@/hooks/use-quests";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { Quest } from "@/types/gitrank";

const groups: Array<Quest["cadence"]> = ["Daily", "Weekly", "Long-term", "Skill-based"];
const QUEST_SECTION_IDS: Record<Quest["cadence"], string> = {
  Daily: "quests-daily",
  Weekly: "quests-weekly",
  "Long-term": "quests-long-term",
  "Skill-based": "quests-skill-based",
};

export function QuestsPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useQuests();
  const quests = data?.quests ?? [];
  const profile = data?.profile;
  const contributionRows = profile?.user.contributions ?? [];
  const streak = summarizeContributionStreak(contributionRows);
  const dayOfYear = dayOfYearUTC(new Date());
  const dayProgress = Math.round((dayOfYear / 365) * 100);
  const [activeGroup, setActiveGroup] = useState<Quest["cadence"]>("Daily");
  const questMap = {
    Daily: quests.filter((quest) => quest.cadence === "Daily"),
    Weekly: quests.filter((quest) => quest.cadence === "Weekly"),
    "Long-term": quests.filter((quest) => quest.cadence === "Long-term"),
    "Skill-based": quests.filter((quest) => quest.cadence === "Skill-based"),
  } as const;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sectionNodes = groups
      .map((group) => {
        const id = QUEST_SECTION_IDS[group];
        const node = document.getElementById(id);
        return node ? ({ id, group, node }) : null;
      })
      .filter(Boolean) as Array<{ id: string; group: Quest["cadence"]; node: HTMLElement }>;

    if (!sectionNodes.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => {
            if (right.intersectionRatio !== left.intersectionRatio) {
              return right.intersectionRatio - left.intersectionRatio;
            }
            return left.boundingClientRect.top - right.boundingClientRect.top;
          });

        const nextId = visible[0]?.target?.id;
        if (!nextId) {
          return;
        }
        const match = sectionNodes.find((section) => section.id === nextId);
        if (!match) {
          return;
        }
        setActiveGroup((current) => (current === match.group ? current : match.group));
      },
      {
        root: null,
        rootMargin: "-24% 0px -56% 0px",
        threshold: [0, 0.2, 0.45, 0.7, 1],
      },
    );

    for (const section of sectionNodes) {
      observer.observe(section.node);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quests"
        title="Quest board"
        description="Daily, weekly, and long-term missions from the backend quest engine with evidence-aware completion states."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/contributions">Open contributions</Link>
          </Button>
        )}
      />
      {data?.staleness?.isStale ? (
        <StaleState
          message={`Quest snapshot refreshed ${formatRelativeDays(
            data.staleness.refreshedAt,
          )}. Live quest signals may lag until the next sync completes.`}
          updatedAt={data.staleness.refreshedAt}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="quests:stale"
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
      {!isLoading && !isError && quests.length > 0 ? (
        <nav
          aria-labelledby="quests-jump-nav-label"
          className="cyber-terminal panel-grid flex flex-wrap items-center gap-2 rounded-[1.2rem] px-3 py-3 xl:sticky xl:top-20 xl:z-20"
        >
          <span id="quests-jump-nav-label" className="px-2 text-xs tracking-[0.14em] text-primary uppercase">Cadence</span>
          <ul role="list" className="flex flex-wrap gap-2">
            {groups.map((group) => {
              const active = group === activeGroup;
              return (
                <li key={group}>
                  <a
                    href={`#${QUEST_SECTION_IDS[group]}`}
                    className={
                      active
                        ? "focus-ring neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold"
                        : "focus-ring neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs"
                    }
                    aria-current={active ? "location" : undefined}
                  >
                    {labelForGroup(group)}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      {isLoading ? <LoadingState message="Building your skill tree..." /> : null}
      {isError ? (
        <ErrorState
          title="Quest engine unavailable"
          description="The recommendation system could not finish. Retry or fall back to your last synced quest board."
          fallbackLabel="Open settings"
          fallbackHref="/dashboard/settings"
          analyticsTarget="quests:error"
        />
      ) : null}
      {!isLoading && !isError && quests.length === 0 ? (
        <EmptyState
          title="No quests ready yet."
          description="Leaderboard unlocks after your first verified score, and quests sharpen once the system sees enough meaningful work."
          actionLabel="Sync profile"
          actionHref="/dashboard/settings"
          analyticsTarget="quests:empty"
        />
      ) : null}
      {!isLoading && !isError && data ? (
        groups.map((group) => {
          const grouped = questMap[group];

          return (
            <section
              key={group}
              id={QUEST_SECTION_IDS[group]}
              className="space-y-4 scroll-mt-24"
            >
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
                  <p>
                    No {labelForGroup(group).toLowerCase()} has been generated by the backend for this profile snapshot yet.
                  </p>
                  <div className="mt-3">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={recoveryHrefForGroup(group)}>{recoveryLabelForGroup(group)}</Link>
                    </Button>
                  </div>
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

function recoveryHrefForGroup(group: Quest["cadence"]): string {
  if (group === "Long-term") {
    return "/dashboard/settings";
  }
  return "/dashboard/contributions";
}

function recoveryLabelForGroup(group: Quest["cadence"]): string {
  if (group === "Long-term") {
    return "Refresh sync settings";
  }
  if (group === "Skill-based") {
    return "Inspect contribution skills";
  }
  return "Open contribution lane";
}
