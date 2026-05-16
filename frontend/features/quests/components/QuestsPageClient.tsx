"use client";

import { CalendarClock, Flame, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Progress } from "@/components/ui/progress";
import { QuestCard } from "@/features/quests/components/QuestCard";
import { useQuests } from "@/hooks/use-quests";
import { summarizeContributionStreak, summarizeRepositories } from "@/lib/metrics/contribution-metrics";
import type { Quest } from "@/types/gitrank";

const groups: Array<Quest["cadence"]> = ["Daily", "Weekly", "Long-term", "Skill-based"];

export function QuestsPageClient() {
  const { data, isLoading, isError } = useQuests();
  const quests = data?.quests ?? [];
  const profile = data?.profile;
  const contributionRows = profile?.user.contributions ?? [];
  const streak = summarizeContributionStreak(contributionRows);
  const repositorySummary = summarizeRepositories(contributionRows, 12);
  const dayOfYear = dayOfYearUTC(new Date());
  const dayProgress = Math.round((dayOfYear / 365) * 100);
  const todaysQuest = buildTodaysQuest(dayOfYear, contributionRows, streak.currentStreakDays, repositorySummary.length);
  const weeklyChallenge = buildWeeklyChallenge(contributionRows, streak.bestStreakDays);
  const longTermJourney = buildLongTermJourney(dayOfYear, contributionRows.length, streak.bestStreakDays);
  const questMap = {
    Daily: mergeQuestGroup(quests, "Daily", todaysQuest),
    Weekly: mergeQuestGroup(quests, "Weekly", weeklyChallenge),
    "Long-term": mergeQuestGroup(quests, "Long-term", longTermJourney),
    "Skill-based": quests.filter((quest) => quest.cadence === "Skill-based"),
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quest board"
        description="Daily missions, weekly challenge ladders, and a 365-day contributor journey with deterministic rotation and evidence-aware completion states."
      />
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
                  Keep streak momentum, rotate quest focus daily, and compound high-signal contributions over the full year.
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
          if (!grouped.length) return null;

          return (
            <section key={group} className="space-y-4">
              <SectionHeader
                title={labelForGroup(group)}
                description={descriptionForGroup(group)}
              />
              <div className="grid gap-4 xl:grid-cols-2">
                {grouped.map((quest) => (
                  <QuestCard key={quest.id} quest={quest} />
                ))}
              </div>
            </section>
          );
        })
      ) : null}
    </div>
  );
}

function mergeQuestGroup(source: Quest[], cadence: Quest["cadence"], primary: Quest): Quest[] {
  const existing = source.filter((quest) => quest.cadence === cadence);
  const withoutPrimary = existing.filter((quest) => quest.id !== primary.id);
  return [primary, ...withoutPrimary];
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
  if (group === "Daily") return "Deterministic rotating mission keyed by UTC date.";
  if (group === "Weekly") return "Higher impact challenge tuned to consistency and contribution quality.";
  if (group === "Long-term") return "Annual progression objective that compounds verified work.";
  return "Target weak lanes with precision missions from profile evidence.";
}

function buildTodaysQuest(
  dayOfYear: number,
  contributions: QuestLikeContribution[],
  streakDays: number,
  repositoriesTouched: number,
): Quest {
  const templates = [
    {
      id: "daily-merge-pr",
      title: "Today's Quest: Ship one meaningful PR",
      description: "Land one merge-worthy contribution with clear scope and reviewer context.",
      goal: 1,
      rewardXp: 90,
      progress: contributionsInLastDays(contributions, 1),
      why: "Daily merge momentum compounds long-term credibility.",
    },
    {
      id: "daily-docs-or-tests",
      title: "Today's Quest: Improve docs or tests",
      description: "Strengthen maintainability with documentation or test evidence.",
      goal: 1,
      rewardXp: 70,
      progress: contributions.filter((row) => isDocOrTest(row.category) && occurredWithinDays(row.mergedAt, 7)).length > 0 ? 1 : 0,
      why: "Maintainers trust contributors who improve reliability and clarity.",
    },
    {
      id: "daily-streak-keepalive",
      title: "Today's Quest: Protect your streak",
      description: "Keep your contribution streak alive with one high-signal action.",
      goal: 1,
      rewardXp: 60,
      progress: streakDays > 0 ? 1 : 0,
      why: "Consistency beats bursts in contributor reputation systems.",
    },
    {
      id: "daily-repo-explorer",
      title: "Today's Quest: Touch a fresh repo lane",
      description: "Expand contribution coverage by engaging a new or dormant repository lane.",
      goal: 1,
      rewardXp: 85,
      progress: repositoriesTouched >= 2 ? 1 : 0,
      why: "Repository breadth improves adaptability and systems context.",
    },
  ] as const;

  const selected = templates[dayOfYear % templates.length];
  const progress = Math.min(selected.goal, selected.progress);
  return {
    id: selected.id,
    title: selected.title,
    description: selected.description,
    status: progress >= selected.goal ? "Completed" : "Active",
    cadence: "Daily",
    rewardXp: selected.rewardXp,
    progress,
    goal: selected.goal,
    whyRecommended: selected.why,
    evidenceSignals: ["Date-rotated deterministic quest", "Profile contribution evidence"],
    linkedContributionIds: contributions.slice(0, 3).map((item) => item.id),
  };
}

function buildWeeklyChallenge(
  contributions: QuestLikeContribution[],
  bestStreakDays: number,
): Quest {
  const recentMerged = contributionsInLastDays(contributions, 7);
  const goal = 3;
  const progress = Math.min(goal, recentMerged);
  return {
    id: "weekly-quality-ladder",
    title: "Weekly Challenge: 3 meaningful contributions",
    description:
      "Complete three evidence-backed contributions this week while preserving quality and review responsiveness.",
    status: progress >= goal ? "Completed" : "Active",
    cadence: "Weekly",
    rewardXp: 220,
    progress,
    goal,
    whyRecommended: `Current best streak is ${bestStreakDays} days. This challenge reinforces consistency without requiring spam.`,
    evidenceSignals: ["Weekly merged contribution count", "Quality-weighted score evidence"],
    linkedContributionIds: contributions.slice(0, 5).map((item) => item.id),
  };
}

function buildLongTermJourney(
  dayOfYear: number,
  contributionCount: number,
  bestStreakDays: number,
): Quest {
  const goal = 120;
  const progress = Math.min(goal, contributionCount);
  return {
    id: "yearly-open-source-journey",
    title: "Long-Term Journey: Build 120 verified contribution events",
    description:
      "Treat this as a year-long campaign: maintain quality, variety, and review depth across seasons.",
    status: progress >= goal ? "Completed" : "Active",
    cadence: "Long-term",
    rewardXp: 900,
    progress,
    goal,
    weakAreaTarget: "Backend",
    whyRecommended: `Day ${dayOfYear} check-in: best streak ${bestStreakDays}d, current evidence count ${contributionCount}.`,
    evidenceSignals: ["Annual progress meter", "Score-event contribution ledger"],
    linkedContributionIds: [],
  };
}

type QuestLikeContribution = {
  id: string;
  category: string;
  mergedAt: string;
};

function contributionsInLastDays(
  contributions: QuestLikeContribution[],
  days: number,
): number {
  return contributions.filter((row) => occurredWithinDays(row.mergedAt, days)).length;
}

function occurredWithinDays(timestamp: string, days: number): boolean {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const now = Date.now();
  return now - date.getTime() <= days * 86_400_000;
}

function isDocOrTest(category: string): boolean {
  const value = category.toLowerCase();
  return value.includes("doc") || value.includes("test");
}
