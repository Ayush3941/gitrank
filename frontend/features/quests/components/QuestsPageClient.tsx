"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, CalendarClock, Flame, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuests } from "@/hooks/use-quests";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { Quest } from "@/types/gitrank";

const groups: Array<Quest["cadence"]> = ["Daily", "Weekly", "Long-term", "Skill-based"];

const QuestCard = dynamic(
  () =>
    import("@/features/quests/components/QuestCard").then(
      (mod) => mod.QuestCard,
    ),
  {
    loading: () => <QuestPanelPlaceholder />,
  },
);

export function QuestsPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useQuests();
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
  const todayQuest = selectQuestSpotlight(
    questMap.Daily.length > 0 ? questMap.Daily : quests,
  );
  const weeklyQuest = selectQuestSpotlight(questMap.Weekly);
  const longTermQuest = selectQuestSpotlight(questMap["Long-term"]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quests"
        title="Quests"
        description="Daily, weekly, and long-term mission tracks."
        actions={(
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/contributions" scroll={false}>
              Open contributions
            </Link>
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
          actionLabel="Open sync settings"
          actionHref="/dashboard/settings"
          analyticsTarget="quests:stale"
        />
      ) : null}
      {!isLoading && !isError && profile ? (
        <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-cyan-100">
                  <CalendarClock className="h-3.5 w-3.5" />
                  365-day contributor journey
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Day {dayOfYear} of 365</h2>
                <p className="mt-2 text-sm text-muted">
                  Keep contribution momentum steady.
                </p>
              </div>
              <div className="grid gap-2 rounded-2xl border border-fuchsia-300/28 bg-fuchsia-400/10 px-4 py-3 text-sm text-fuchsia-100">
                <span className="inline-flex items-center gap-2"><Flame className="h-4 w-4" /> Current streak: <span className="numeric-readout">{streak.currentStreakDays.toLocaleString("en-US")}d</span></span>
                <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Best streak: <span className="numeric-readout">{streak.bestStreakDays.toLocaleString("en-US")}d</span></span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Annual progression</span>
                <span className="numeric-readout">{dayProgress}%</span>
              </div>
              <Progress value={dayProgress} />
            </div>
          </div>
        </GlowCard>
      ) : null}
      {!isLoading && !isError ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Mission spotlight</h2>
          <GlowCard className="space-y-4 border border-primary/18 bg-gradient-to-br from-slate-950/86 to-cyan-950/18">
            <ul role="list" className="grid gap-3 md:grid-cols-3">
              <MissionSpotlightCard
                title="Today's Quest"
                quest={todayQuest}
                emptyCopy="No daily mission yet."
                href="/dashboard/contributions"
                cta="Open contributions"
              />
              <MissionSpotlightCard
                title="Weekly Challenge"
                quest={weeklyQuest}
                emptyCopy="No weekly challenge yet."
                href="/dashboard/settings"
                cta="Open sync settings"
              />
              <MissionSpotlightCard
                title="Long-Term Journey"
                quest={longTermQuest}
                emptyCopy="No long-term objective yet."
                href="/dashboard/contributions"
                cta="Keep building"
              />
            </ul>
          </GlowCard>
        </div>
      ) : null}
      {isLoading ? <LoadingState message="Building your skill tree..." /> : null}
      {isError ? (
        <ErrorState
          title="Quest engine unavailable"
          description="The recommendation system could not finish. Retry or fall back to your last synced quest board."
          onRetry={() => {
            void refetch();
          }}
          fallbackLabel="Open sync settings"
          fallbackHref="/dashboard/settings"
          analyticsTarget="quests:error"
        />
      ) : null}
      {!isLoading && !isError && quests.length === 0 ? (
        <EmptyState
          eyebrow="Quest generation"
          title="No quests ready yet."
          description="Sync and complete scored contributions to unlock quests."
          actionLabel="Sync profile"
          actionHref="/dashboard/settings"
          secondaryActionLabel="Open contributions"
          secondaryActionHref="/dashboard/contributions"
          analyticsTarget="quests:empty"
        />
      ) : null}
      {!isLoading && !isError && data ? (
        groups.map((group) => {
          const grouped = questMap[group];

          return (
            <section
              key={group}
              className="render-opt-section space-y-4"
            >
              <details open={group === "Daily" || group === "Weekly"} className="space-y-3">
                <summary className="focus-ring neon-surface cursor-pointer list-none px-4 py-3 text-sm font-semibold text-white marker:content-none">
                  {labelForGroup(group)} ({grouped.length})
                </summary>
                <div>
                  {grouped.length > 0 ? (
                    <ul role="list" className="grid gap-4 xl:grid-cols-2">
                      {grouped.map((quest) => (
                        <li key={quest.id} className="list-none">
                          <QuestCard quest={quest} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <GlowCard className="neon-surface rounded-[1.5rem] border-dashed border-cyan-300/24 p-4 text-sm text-muted">
                      <p>
                        No {labelForGroup(group).toLowerCase()} in this snapshot.
                      </p>
                      <div className="mt-3">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={recoveryHrefForGroup(group)} scroll={false}>{recoveryLabelForGroup(group)}</Link>
                        </Button>
                      </div>
                    </GlowCard>
                  )}
                </div>
              </details>
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
  return "Open contributions";
}

function selectQuestSpotlight(source: Quest[]): Quest | null {
  if (!source.length) {
    return null;
  }
  const ranked = [...source].sort((left, right) => {
    const leftRank = questStatusRank(left.status);
    const rightRank = questStatusRank(right.status);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    const leftProgress = safeQuestProgress(left);
    const rightProgress = safeQuestProgress(right);
    if (leftProgress !== rightProgress) {
      return rightProgress - leftProgress;
    }
    if (left.rewardXp !== right.rewardXp) {
      return right.rewardXp - left.rewardXp;
    }
    return left.title.localeCompare(right.title);
  });
  return ranked[0] ?? null;
}

function questStatusRank(status: Quest["status"]): number {
  if (status === "Active") {
    return 0;
  }
  if (status === "Locked") {
    return 1;
  }
  return 2;
}

function safeQuestProgress(quest: Quest): number {
  const goal = quest.goal > 0 ? quest.goal : 1;
  const ratio = (quest.progress / goal) * 100;
  if (!Number.isFinite(ratio)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(ratio)));
}

function MissionSpotlightCard({
  title,
  quest,
  emptyCopy,
  href,
  cta,
}: {
  title: string;
  quest: Quest | null;
  emptyCopy: string;
  href: string;
  cta: string;
}) {
  if (!quest) {
    return (
      <li className="list-none">
        <div className="neon-surface space-y-3 border-dashed border-primary/24 px-4 py-4">
          <p className="text-xs font-medium text-primary">{title}</p>
          <p className="text-sm text-muted">{emptyCopy}</p>
          <Button asChild variant="secondary" size="sm">
            <Link href={href} scroll={false}>
              {cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </li>
    );
  }

  const progress = safeQuestProgress(quest);
  const statusMeta = questStatusMeta(quest.status);

  return (
    <li className="list-none">
      <div className="neon-surface space-y-3 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">{title}</p>
            <p className="mt-2 text-base font-semibold text-white">{quest.title}</p>
            <span className={statusMeta.className}>
              {statusMeta.label}
            </span>
          </div>
          <span className="neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold">
            <span className="numeric-readout">+{quest.rewardXp.toLocaleString("en-US")} XP</span>
          </span>
        </div>
        <p className="text-sm text-muted">{quest.description}</p>
        <div className="space-y-1">
          <Progress value={progress} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="numeric-readout">{quest.progress.toLocaleString("en-US")} / {quest.goal.toLocaleString("en-US")}</span>
            <span className="numeric-readout">{progress}%</span>
          </div>
        </div>
        <p className="text-xs text-cyan-100">
          Next move: {recoveryLabelForGroup(quest.cadence)}
        </p>
        <Button asChild variant="secondary" size="sm">
          <Link href={recoveryHrefForGroup(quest.cadence)} scroll={false}>
            {recoveryLabelForGroup(quest.cadence)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </li>
  );
}

function questStatusMeta(status: Quest["status"]): { label: string; className: string } {
  if (status === "Completed") {
    return {
      label: "Completed",
      className: "mt-2 inline-flex neon-chip neon-chip-success rounded-full px-2.5 py-1 text-xs font-semibold",
    };
  }
  if (status === "Locked") {
    return {
      label: "Locked",
      className: "mt-2 inline-flex neon-chip neon-chip-warning rounded-full px-2.5 py-1 text-xs font-semibold",
    };
  }
  return {
    label: "Active",
    className: "mt-2 inline-flex neon-chip neon-chip-info rounded-full px-2.5 py-1 text-xs font-semibold",
  };
}

function QuestPanelPlaceholder() {
  return (
    <GlowCard className="space-y-3">
      <p className="text-xs font-medium text-primary">Loading quest card</p>
      <div className="neon-skeleton h-9 w-2/5" />
      <div className="neon-skeleton h-24 w-full" />
    </GlowCard>
  );
}
