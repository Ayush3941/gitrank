"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowRight, CheckCircle2, Circle, Flame, ListChecks, Medal, ShieldCheck, Sparkles, Swords } from "lucide-react";
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
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { SectionJumpNav } from "@/components/shared/SectionJumpNav";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import { formatRelativeDays } from "@/lib/formatters";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { initialSectionFromHash } from "@/lib/section-nav";

const DASHBOARD_SECTION_NAV = [
  { id: "dashboard-hero", label: "Hero" },
  { id: "dashboard-snapshot", label: "Snapshot" },
  { id: "dashboard-league", label: "League" },
  { id: "dashboard-skills", label: "Skills" },
  { id: "dashboard-reports", label: "Reports" },
  { id: "dashboard-badges", label: "Badges" },
  { id: "dashboard-timeline", label: "Timeline" },
] as const;
type DashboardSectionID = (typeof DASHBOARD_SECTION_NAV)[number]["id"];
const DASHBOARD_SECTION_IDS = DASHBOARD_SECTION_NAV.map(
  (section) => section.id,
) as DashboardSectionID[];
const DASHBOARD_DEFAULT_SECTION: DashboardSectionID = "dashboard-hero";

export function DashboardPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useDashboard();
  const scoreExplanationEventSent = useRef(false);
  const [activeSection, setActiveSection] =
    useState<DashboardSectionID>(DASHBOARD_DEFAULT_SECTION);
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
  const activeSectionLabel =
    DASHBOARD_SECTION_NAV.find((section) => section.id === activeSection)?.label ??
    "Hero";
  const activeSectionLink = `/dashboard#${activeSection}`;
  const contributionWindowFillRate =
    contributionWindowCap > 0
      ? Math.round((contributionWindowCount / contributionWindowCap) * 100)
      : 0;
  const firstRunSteps = useMemo(() => {
    const syncState = user?.syncStatus.state;
    const partialProfileAvailable = user?.syncStatus.partialProfileAvailable ?? false;
    const mergedPrCount = user?.mergedPrCount ?? 0;
    return [
      {
        id: "connected",
        label: "GitHub account connected",
        detail: "OAuth identity is linked and ready for evidence sync.",
        done: Boolean(user?.username),
        href: "/dashboard/settings",
        actionLabel: "Open account settings",
      },
      {
        id: "synced",
        label: "Profile sync completed",
        detail:
          "A full snapshot is marked synced without partial evidence mode.",
        done: syncState === "synced" && !partialProfileAvailable,
        href: "/dashboard/settings",
        actionLabel: "Review sync state",
      },
      {
        id: "first-merge",
        label: "First merged PR detected",
        detail:
          "Merged contribution evidence unlocks full score movement and quest depth.",
        done: mergedPrCount > 0,
        href: "/dashboard/contributions",
        actionLabel: "Open contribution lane",
      },
    ];
  }, [
    user?.mergedPrCount,
    user?.syncStatus.partialProfileAvailable,
    user?.syncStatus.state,
    user?.username,
  ]);
  const firstRunCompletedCount = firstRunSteps.filter((step) => step.done).length;
  const firstRunProgress = Math.round((firstRunCompletedCount / firstRunSteps.length) * 100);
  const showFirstRunChecklist =
    (user?.mergedPrCount ?? 0) <= 0 && contributionWindowCount === 0;
  const firstRunNextAction = firstRunSteps.find((step) => !step.done) ?? null;
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
    if (
      !shouldRequestAbraInsights({
        showAiSummaries: user.privacy.showAiSummaries !== false,
        mergedPrCount: user.mergedPrCount,
        contributionCount: user.contributions.length,
      })
    ) {
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
  const fallbackArchetype = useMemo(
    () => (user ? deriveDeterministicArchetype(user.strongestSignals) : "Systems Builder"),
    [user],
  );
  const fallbackIdentitySummary = useMemo(() => {
    if (!data || !user) {
      return undefined;
    }
    return buildDeterministicIdentitySummary({
      displayName: user.displayName,
      rankTier: user.level.rankTier,
      level: user.level.currentLevel,
      totalXp: user.level.currentXp,
      mergedPrCount: user.mergedPrCount,
      strongestSignals: user.strongestSignals,
      repositoriesTouched: user.repositories.length,
      streakDays: streak.currentStreakDays,
      isStale: data.isStale,
      trendWindowLabel: data.trendWindowLabel,
    });
  }, [data, streak.currentStreakDays, user]);

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

    const syncFromHash = () => {
      const nextSection = initialSectionFromHash(
        DASHBOARD_SECTION_IDS,
        DASHBOARD_DEFAULT_SECTION,
        window.location.hash,
      );
      setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    const sectionNodes = DASHBOARD_SECTION_NAV
      .map((section) => document.getElementById(section.id))
      .filter(Boolean) as HTMLElement[];

    if (!sectionNodes.length) {
      window.removeEventListener("hashchange", syncFromHash);
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

        const nextSectionId = visibleEntries[0]?.target?.id;
        if (!nextSectionId) {
          return;
        }
        const nextSection = initialSectionFromHash(
          DASHBOARD_SECTION_IDS,
          DASHBOARD_DEFAULT_SECTION,
          `#${nextSectionId}`,
        );
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
      window.removeEventListener("hashchange", syncFromHash);
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
      <SectionJumpNav
        navLabelID="dashboard-jump-nav-label"
        landmarkLabel="Dashboard section navigation"
        activeSectionLabel={activeSectionLabel}
        items={DASHBOARD_SECTION_NAV}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
        copyHref={activeSectionLink}
        copyAnalyticsTarget="dashboard/copy-section-link"
        className="mb-1"
      />
      <section id="dashboard-hero" className="scroll-mt-24">
        <DashboardHeroRankCard
          user={user}
          archetype={abraInsights.data?.archetype ?? fallbackArchetype}
          identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
          aiMode={abraInsights.data?.generatedBy ?? "deterministic"}
        />
      </section>
      <section id="dashboard-snapshot" className="scroll-mt-24 grid gap-4 xl:grid-cols-[1.25fr,1fr]">
        <div className="glass-panel cyber-card cyber-frame space-y-4 p-5 sm:p-6">
          <p className="text-xs font-medium text-primary">Immediate next move</p>
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
          <p className="inline-flex items-center gap-2 text-xs text-cyan-100">
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
      {showFirstRunChecklist ? (
        <FirstRunChecklistCard
          steps={firstRunSteps}
          completedCount={firstRunCompletedCount}
          totalCount={firstRunSteps.length}
          progress={firstRunProgress}
          nextAction={firstRunNextAction}
        />
      ) : null}
      <GlowCard className="space-y-4 border border-primary/22 bg-gradient-to-br from-slate-950/90 to-cyan-950/18">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-primary">Evidence context</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">How current this snapshot is</h2>
            <p className="mt-2 text-sm text-muted">
              Dashboard values are generated from persisted score and profile evidence. Use this strip to confirm freshness and scope before making comparisons.
            </p>
          </div>
          <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            Refreshed {formatRelativeDays(data.refreshedAt)}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <EvidenceContextItem
            label="Sync state"
            value={formatSyncState(user.syncStatus.state)}
            detail={user.syncStatus.partialProfileAvailable ? "Partial profile mode active" : "Full profile evidence mode"}
          />
          <EvidenceContextItem
            label="Evidence scope"
            value={`${contributionWindowCount}/${contributionWindowCap} PR rows`}
            detail={`${contributionWindowFillRate}% of the capped recent PR history window`}
          />
          <EvidenceContextItem
            label="Current step"
            value={user.syncStatus.currentStep || "Idle"}
            detail="Last known pipeline stage reported by the authenticated sync state"
          />
        </div>
      </GlowCard>
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="space-y-6">
          <section id="dashboard-league" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading league snapshot" />}>
              <CurrentLeagueCard user={user} />
            </DeferUntilVisible>
          </section>
          <section className="render-opt-section">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading quest board" />}>
              <QuestPanel quests={user.quests} />
            </DeferUntilVisible>
          </section>
          <section className="render-opt-section">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading score explanation" />}>
              <ScoreExplanationCard user={user} />
            </DeferUntilVisible>
          </section>
        </div>
        <div className="space-y-6">
          <section id="dashboard-skills" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading skill breakdown" />}>
              <SkillBreakdownCard
                user={user}
                skillInsights={abraInsights.data?.skillInsights}
                aiMode={abraInsights.data?.generatedBy}
              />
            </DeferUntilVisible>
          </section>
          <section id="dashboard-reports" className="render-opt-section scroll-mt-24">
            <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading battle reports" />}>
              <RecentBattleReports reports={recentReports} />
            </DeferUntilVisible>
          </section>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <section id="dashboard-badges" className="render-opt-section scroll-mt-24">
          <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading badge shelf" />}>
            <BadgeShelf user={user} />
          </DeferUntilVisible>
        </section>
        <section id="dashboard-timeline" className="render-opt-section scroll-mt-24">
          <DeferUntilVisible fallback={<SectionDeferredPlaceholder title="Loading contribution timeline" />}>
            <ContributionTimelineCard user={user} />
          </DeferUntilVisible>
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

type FirstRunStep = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  href: string;
  actionLabel: string;
};

function FirstRunChecklistCard({
  steps,
  completedCount,
  totalCount,
  progress,
  nextAction,
}: {
  steps: FirstRunStep[];
  completedCount: number;
  totalCount: number;
  progress: number;
  nextAction: FirstRunStep | null;
}) {
  return (
    <GlowCard className="space-y-4 border border-cyan-300/25 bg-gradient-to-br from-slate-950/90 to-cyan-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-medium text-cyan-200">
            <ListChecks className="h-3.5 w-3.5" />
            First-run checklist
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Activation path</h2>
          <p className="mt-2 text-sm text-muted">
            Complete these steps to move from an empty snapshot to meaningful score and quest progression.
          </p>
        </div>
        <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
          {completedCount}/{totalCount} complete
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-primary">
          <span>Progress</span>
          <span className="numeric-readout">{progress}%</span>
        </div>
        <div
          className="h-2 w-full rounded-full border border-primary/25 bg-primary/8"
          role="progressbar"
          aria-label="Activation checklist progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-300 to-fuchsia-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <ol role="list" className="grid gap-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <div className="neon-surface flex items-start gap-3 rounded-[0.1rem] border px-3 py-3">
            <div className="mt-0.5 text-primary">
              {step.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Circle className="h-4 w-4 text-cyan-200" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                Step {index + 1}: {step.label}
              </p>
              <p className="mt-1 text-xs text-muted">{step.detail}</p>
            </div>
            </div>
          </li>
        ))}
      </ol>
      {nextAction ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={nextAction.href}>
              {nextAction.actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/onboarding/reveal">Review reveal summary</Link>
          </Button>
        </div>
      ) : null}
    </GlowCard>
  );
}

function EvidenceContextItem({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="neon-surface space-y-2 px-4 py-4">
      <p className="text-xs font-medium text-primary">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-muted">{detail}</p>
    </div>
  );
}

function SectionDeferredPlaceholder({ title }: { title: string }) {
  return (
    <div
      className="glass-panel cyber-card cyber-frame flex min-h-[12rem] items-center justify-center p-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="text-sm text-muted">{title}</p>
    </div>
  );
}

function formatSyncState(state: string): string {
  return state.replaceAll("_", " ");
}
