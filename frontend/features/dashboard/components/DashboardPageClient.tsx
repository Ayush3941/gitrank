"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, Flame, Medal, ShieldCheck, Sparkles, Swords, Waypoints } from "lucide-react";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { ContributionTimelineCard } from "@/features/dashboard/components/ContributionTimelineCard";
import { CurrentLeagueCard } from "@/features/dashboard/components/CurrentLeagueCard";
import { QuestPanel } from "@/features/dashboard/components/QuestPanel";
import { RecentBattleReports } from "@/features/dashboard/components/RecentBattleReports";
import { ScoreExplanationCard } from "@/features/dashboard/components/ScoreExplanationCard";
import { SkillBreakdownCard } from "@/features/dashboard/components/SkillBreakdownCard";
import { BadgeShelf } from "@/features/dashboard/components/BadgeShelf";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useDashboard } from "@/hooks/use-dashboard";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { formatRelativeDays } from "@/lib/formatters";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";

const DASHBOARD_SECTION_NAV = [
  { id: "dashboard-hero", label: "Hero" },
  { id: "dashboard-snapshot", label: "Snapshot" },
  { id: "dashboard-league", label: "League" },
  { id: "dashboard-skills", label: "Skills" },
  { id: "dashboard-reports", label: "Reports" },
  { id: "dashboard-badges", label: "Badges" },
  { id: "dashboard-timeline", label: "Timeline" },
] as const;

export function DashboardPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useDashboard();
  const scoreExplanationEventSent = useRef(false);
  const [activeSection, setActiveSection] = useState<string>(DASHBOARD_SECTION_NAV[0].id);
  const user = data?.user;
  const recentReports = data?.recentReports ?? [];
  const streak = useMemo(
    () => summarizeContributionStreak(user?.contributions ?? []),
    [user?.contributions],
  );
  const contributionWindowCap = 100;
  const contributionWindowCount = Math.min(
    user?.contributions.length ?? 0,
    contributionWindowCap,
  );
  const contributionWindowFillRate =
    contributionWindowCap > 0
      ? Math.round((contributionWindowCount / contributionWindowCap) * 100)
      : 0;
  const nextAction = useMemo(() => {
    if (!user) {
      return {
        href: "/dashboard/settings",
        label: "Open sync and privacy settings",
        detail: "Reconnect GitHub or refresh your profile data to continue.",
      };
    }
    if (user.syncStatus.state === "failed" || user.syncStatus.state === "rate_limited") {
      return {
        href: "/dashboard/settings",
        label: "Recover sync pipeline",
        detail: "GitHub evidence is blocked. Retry sync and inspect account connection settings.",
      };
    }
    if (user.mergedPrCount <= 0) {
      return {
        href: "/dashboard/settings",
        label: "Run first GitHub sync",
        detail: "Bring your merged PR history into GitRank so score, skills, and quests can activate.",
      };
    }
    if (user.quests.some((quest) => quest.status === "Active")) {
      return {
        href: "/dashboard/quests",
        label: "Continue active quest",
        detail: "Your fastest rank-up path is currently in the quest lane with verified weak-skill targets.",
      };
    }
    return {
      href: "/dashboard/contributions",
      label: "Review highest-impact PR cards",
      detail: "Inspect battle reports and impact narratives to optimize your next contribution cycle.",
    };
  }, [user]);
  const abraPayload = useMemo(() => {
    if (!user) {
      return null;
    }
    return {
      profile: {
        username: user.username,
        displayName: user.displayName,
        currentTitle: user.title,
        rankTier: user.level.rankTier,
        level: user.level.currentLevel,
        totalXp: user.level.currentXp,
        mergedPrCount: user.mergedPrCount,
        strongestSignals: user.strongestSignals,
        repositoriesTouched: user.repositories.length,
        badgeCount: user.badges.filter((badge) => badge.unlocked).length,
        streakDays: streak.currentStreakDays,
      },
      contributions: user.contributions.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.title,
        owner: row.owner,
        repo: row.repo,
        number: row.number,
        category: row.category,
        status: row.status,
        xpEarned: row.xpEarned,
        mergedAt: row.mergedAt,
        summary: row.aiSummary,
        evidenceSignals: row.evidenceSignals,
      })),
      badges: user.badges.slice(0, 8).map((badge) => ({
        id: badge.id,
        name: badge.name,
        rarity: badge.rarity,
        unlocked: badge.unlocked,
        earnedAt: badge.earnedAt,
        description: badge.description,
        unlockCondition: badge.unlockCondition,
        progress: badge.progress ?? (badge.unlocked ? 100 : 0),
        evidencePrIds: badge.evidencePrIds,
      })),
    };
  }, [streak.currentStreakDays, user]);
  const abraInsights = useAbraInsights(abraPayload);

  useEffect(() => {
    if (isLoading || isError || !data || scoreExplanationEventSent.current) {
      return;
    }
    scoreExplanationEventSent.current = true;
    void emitAnalyticsEvent({
      eventName: "score_explanation.opened",
      source: "frontend",
      target: "dashboard",
      status: "success",
    });
  }, [data, isError, isLoading]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const sectionNodes = DASHBOARD_SECTION_NAV
      .map((section) => document.getElementById(section.id))
      .filter(Boolean) as HTMLElement[];

    if (!sectionNodes.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => {
            if (right.intersectionRatio !== left.intersectionRatio) {
              return right.intersectionRatio - left.intersectionRatio;
            }
            return left.boundingClientRect.top - right.boundingClientRect.top;
          });

        const nextSection = visibleEntries[0]?.target?.id;
        if (!nextSection) {
          return;
        }
        setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
      },
      {
        root: null,
        rootMargin: "-22% 0px -62% 0px",
        threshold: [0, 0.2, 0.45, 0.7, 1],
      },
    );

    for (const node of sectionNodes) {
      observer.observe(node);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  if (isLoading) {
    return <LoadingState message="Building your RPG dashboard..." />;
  }

  if (isError || !data || !user) {
    return (
      <ErrorState
        title="Dashboard sync failed"
        description="GitHub rate limits or AI analysis delays can leave the dashboard partially unavailable. Retry or fall back to the last verified profile."
        fallbackLabel="Open settings"
        fallbackHref="/dashboard/settings"
        analyticsTarget="dashboard:error"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Command center"
        description="Snapshot-based contribution analytics, progression, and score explanations weighted toward meaningful merged work."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/settings">Sync and privacy</Link>
          </Button>
        )}
      />
      {user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Your GitRank profile was refreshed ${formatRelativeDays(
            data.refreshedAt,
          )}.`}
          updatedAt={data.refreshedAt}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
          analyticsTarget="dashboard:stale"
        />
      ) : null}
      <nav
        aria-labelledby="dashboard-jump-nav-label"
        className="cyber-terminal panel-grid flex flex-wrap items-center gap-2 rounded-[1.2rem] px-3 py-3 xl:sticky xl:top-20 xl:z-20"
      >
        <span id="dashboard-jump-nav-label" className="inline-flex items-center gap-2 px-2 text-xs tracking-[0.14em] text-primary uppercase">
          <Waypoints className="h-3.5 w-3.5" />
          Jump
        </span>
        <ul role="list" className="flex flex-wrap gap-2">
          {DASHBOARD_SECTION_NAV.map((section) => {
            const active = section.id === activeSection;
            return (
              <li key={section.id}>
                <a
                  className={
                    active
                      ? "focus-ring neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold"
                      : "focus-ring neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs"
                  }
                  href={`#${section.id}`}
                  aria-current={active ? "location" : undefined}
                >
                  {section.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      <section id="dashboard-hero" className="scroll-mt-24">
        <DashboardHeroRankCard
          user={user}
          archetype={abraInsights.data?.archetype}
          identitySummary={abraInsights.data?.identitySummary}
          aiMode={abraInsights.data?.generatedBy}
        />
      </section>
      <section id="dashboard-snapshot" className="scroll-mt-24 grid gap-4 xl:grid-cols-[1.25fr,1fr]">
        <div className="glass-panel cyber-card cyber-frame space-y-4 p-5 sm:p-6">
          <p className="text-xs tracking-[0.22em] text-primary uppercase">Immediate next move</p>
          <h2 className="text-2xl font-semibold text-white">{nextAction.label}</h2>
          <p className="readable-measure text-sm leading-7 text-muted">{nextAction.detail}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm">
              <Link href={nextAction.href}>
                Open lane
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard/contributions">Inspect contribution cards</Link>
            </Button>
          </div>
          <p className="inline-flex items-center gap-2 text-xs text-cyan-100/88">
            <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
            Dashboard follows a summary-first flow: snapshot, then drill-down panels.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="GitRank score" value={user.gitRankScore} detail="Weighted by impact, reviews, tests, and repository context." icon={<Medal className="h-5 w-5 text-primary" />} />
          <StatCard label="Merged PRs" value={user.mergedPrCount} detail="Only verified merged work receives full progression value." icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
          <StatCard
            label="PR evidence window"
            value={`${contributionWindowCount}/${contributionWindowCap}`}
            detail={`Current profile includes ${contributionWindowFillRate}% of the capped recent PR history window.`}
            icon={<Activity className="h-5 w-5 text-primary" />}
          />
          <StatCard label="Reviewed PRs" value={user.reviewedPrCount} detail="Review participation increases trust and unlocks deeper quests." icon={<Activity className="h-5 w-5 text-primary" />} />
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="space-y-6">
          <section id="dashboard-league" className="scroll-mt-24">
            <CurrentLeagueCard user={user} />
          </section>
          <QuestPanel quests={user.quests} />
          <ScoreExplanationCard user={user} />
        </div>
        <div className="space-y-6">
          <section id="dashboard-skills" className="scroll-mt-24">
            <SkillBreakdownCard
              user={user}
              skillInsights={abraInsights.data?.skillInsights}
              aiMode={abraInsights.data?.generatedBy}
            />
          </section>
          <section id="dashboard-reports" className="scroll-mt-24">
            <RecentBattleReports reports={recentReports} />
          </section>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <section id="dashboard-badges" className="scroll-mt-24">
          <BadgeShelf user={user} />
        </section>
        <section id="dashboard-timeline" className="scroll-mt-24">
          <ContributionTimelineCard user={user} />
        </section>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Anti-spam rule"
          value="Meaning over volume"
          detail="Spam PRs do not make you powerful here. Thin unreviewed work gets penalized or capped."
          icon={<Swords className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Current streak"
          value={`${streak.currentStreakDays}d`}
          detail={`Best streak ${streak.bestStreakDays} days • active days this year ${streak.activeDaysThisYear}.`}
          icon={<Flame className="h-5 w-5 text-primary" />}
        />
      </div>
    </div>
  );
}
