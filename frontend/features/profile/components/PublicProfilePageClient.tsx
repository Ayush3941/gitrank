"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, CalendarClock, CheckCircle2, GitPullRequest, ShieldCheck, Stars } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionJumpNav } from "@/components/shared/SectionJumpNav";
import { SkillRadarChart } from "@/components/shared/SkillRadarChart";
import { TimelineChart } from "@/components/shared/TimelineChart";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { BestPRsPanel } from "@/features/profile/components/BestPRsPanel";
import { PublicProfileHero } from "@/features/profile/components/PublicProfileHero";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useProfile } from "@/hooks/use-profile";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { initialSectionFromHash } from "@/lib/section-nav";

type PublicProfileSectionID =
  | "public-profile-overview"
  | "public-profile-badges-skills"
  | "public-profile-best-prs"
  | "public-profile-timeline-repos";

const PUBLIC_PROFILE_SECTION_ITEMS: Array<{ id: PublicProfileSectionID; label: string }> = [
  { id: "public-profile-overview", label: "Overview" },
  { id: "public-profile-badges-skills", label: "Badges & Skills" },
  { id: "public-profile-best-prs", label: "Best PRs" },
  { id: "public-profile-timeline-repos", label: "Timeline & Repos" },
];
const PUBLIC_PROFILE_SECTION_IDS = PUBLIC_PROFILE_SECTION_ITEMS.map(
  (section) => section.id,
) as PublicProfileSectionID[];
const PUBLIC_PROFILE_DEFAULT_SECTION: PublicProfileSectionID = "public-profile-overview";

export function PublicProfilePageClient({
  username,
}: {
  username: string;
}) {
  const { data, isLoading, isError, isFetching, refetch } = useProfile(username);
  const [activeSection, setActiveSection] =
    useState<PublicProfileSectionID>(PUBLIC_PROFILE_DEFAULT_SECTION);
  const activeSectionLabel =
    PUBLIC_PROFILE_SECTION_ITEMS.find((section) => section.id === activeSection)?.label ??
    "Overview";
  const streak = summarizeContributionStreak(data?.user.contributions ?? []);
  const abraPayload = useMemo(() => {
    if (!data) {
      return null;
    }
    if (
      !shouldRequestAbraInsights({
        showAiSummaries: data.user.privacy.showAiSummaries !== false,
        mergedPrCount: data.user.mergedPrCount,
        contributionCount: data.user.contributions.length,
      })
    ) {
      return null;
    }
    return {
      profile: {
        username: data.user.username,
        displayName: data.user.displayName,
        currentTitle: data.user.title,
        rankTier: data.user.level.rankTier,
        level: data.user.level.currentLevel,
        totalXp: data.user.level.currentXp,
        mergedPrCount: data.user.mergedPrCount,
        strongestSignals: data.user.strongestSignals,
        repositoriesTouched: data.topRepositories.length,
        badgeCount: data.user.badges.filter((badge) => badge.unlocked).length,
        streakDays: streak.currentStreakDays,
      },
      contributions: data.user.contributions.slice(0, 8).map((row) => ({
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
      badges: data.user.badges.slice(0, 8).map((badge) => ({
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
  }, [data, streak.currentStreakDays]);
  const abraInsights = useAbraInsights(abraPayload);
  const fallbackArchetype = useMemo(
    () => (data ? deriveDeterministicArchetype(data.user.strongestSignals) : "Systems Builder"),
    [data],
  );
  const fallbackIdentitySummary = useMemo(() => {
    if (!data) {
      return undefined;
    }
    return buildDeterministicIdentitySummary({
      displayName: data.user.displayName,
      rankTier: data.user.level.rankTier,
      level: data.user.level.currentLevel,
      totalXp: data.user.level.currentXp,
      mergedPrCount: data.user.mergedPrCount,
      strongestSignals: data.user.strongestSignals,
      repositoriesTouched: data.topRepositories.length,
      streakDays: streak.currentStreakDays,
      isStale: data.isStale,
      trendWindowLabel: data.trendWindowLabel,
    });
  }, [data, streak.currentStreakDays]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      const nextSection = initialSectionFromHash(
        PUBLIC_PROFILE_SECTION_IDS,
        PUBLIC_PROFILE_DEFAULT_SECTION,
        window.location.hash,
      );
      setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const nextSection = initialSectionFromHash(
          PUBLIC_PROFILE_SECTION_IDS,
          PUBLIC_PROFILE_DEFAULT_SECTION,
          `#${visible.target.id}`,
        );
        setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
      },
      { rootMargin: "-22% 0px -55% 0px", threshold: [0.2, 0.45, 0.7] },
    );

    PUBLIC_PROFILE_SECTION_ITEMS.forEach(({ id }) => {
      const node = document.getElementById(id);
      if (node) {
        observer.observe(node);
      }
    });

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      observer.disconnect();
    };
  }, []);

  if (isLoading) {
    return <LoadingState message="Preparing public reputation card..." />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Profile unavailable"
        description="The public profile could not be loaded. Retry or return to the dashboard snapshot."
        fallbackLabel="Open dashboard"
        fallbackHref="/dashboard"
        analyticsTarget="public-profile:error"
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        eyebrow="Public profile visibility"
        title="Profile unavailable"
        description="This profile is hidden, missing, or has not earned a public GitRank score yet."
        actionLabel="Open dashboard"
        actionHref="/dashboard"
        secondaryActionLabel="Open homepage"
        secondaryActionHref="/"
        analyticsTarget="public-profile:empty"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Public profile"
        title={`${data.user.displayName} on GitRank`}
        description="Share-ready contributor identity with evidence-backed score context, progression signals, and verifiable contribution highlights."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard">Open dashboard</Link>
          </Button>
        )}
      />
      {data.isStale ? (
        <StaleState
          message={`This profile snapshot was refreshed ${formatRelativeDays(data.refreshedAt)}.`}
          updatedAt={data.refreshedAt}
          onRefresh={() => {
            void refetch();
          }}
          isRefreshing={isFetching}
          actionLabel="Open dashboard"
          actionHref="/dashboard"
          analyticsTarget="public-profile:stale"
        />
      ) : null}
      <SectionJumpNav
        navLabelID="public-profile-jump-nav-label"
        landmarkLabel="Public profile section navigation"
        activeSectionLabel={activeSectionLabel}
        items={PUBLIC_PROFILE_SECTION_ITEMS}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
      />
      <section id="public-profile-overview" className="scroll-mt-24 space-y-6">
        <PublicProfileHero
          user={data.user}
          shareHeadline={data.shareHeadline}
          archetype={abraInsights.data?.archetype ?? fallbackArchetype}
          identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
          aiMode={abraInsights.data?.generatedBy ?? "deterministic"}
        />
        <GlowCard className="space-y-4 border border-primary/22 bg-gradient-to-br from-slate-950/90 to-cyan-950/18">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-primary">Profile proof strip</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Share-ready evidence context</h2>
              <p className="mt-2 text-sm text-muted">
                Public profile claims are snapshot-based and explainable. Use these fields to communicate freshness, scope, and confidence when sharing this card.
              </p>
            </div>
            <span className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold">
              <CalendarClock className="h-3.5 w-3.5" />
              Refreshed {formatRelativeDays(data.refreshedAt)}
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ProofStripItem
              label="Snapshot state"
              value={data.isStale ? "Stale snapshot" : "Fresh snapshot"}
              detail={data.partialProfileAvailable ? "Partial evidence mode" : "Complete evidence mode"}
            />
            <ProofStripItem
              label="Evidence scope"
              value={`${data.user.contributions.length} contribution events`}
              detail={`${data.user.mergedPrCount} merged PRs included in this public read model`}
            />
            <ProofStripItem
              label="Trend window"
              value={data.trendWindowLabel}
              detail="Timeline and consistency signals are bounded to this configured window"
            />
          </div>
        </GlowCard>
        <div className="neon-callout rounded-[1.75rem] px-4 py-3 text-sm text-muted">
          Public profiles summarize recent contribution evidence. Skill areas and repository rankings are snapshot-based signals, not absolute claims of expertise.
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total XP" value={data.user.gitRankScore} detail="The explainable score ledger currently served on this profile." icon={<Stars className="h-5 w-5 text-primary" />} />
          <StatCard label="Merged PRs" value={data.user.mergedPrCount} detail="Merged work is the core reputation primitive." icon={<GitPullRequest className="h-5 w-5 text-primary" />} />
          <StatCard label="Badges earned" value={data.user.badges.filter((badge) => badge.unlocked).length} detail="Verified contribution milestones, not vanity counters." icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
          <StatCard label="Consistency" value={`${data.user.consistencyScore}%`} detail={`Trend window: ${data.trendWindowLabel}`} icon={<CheckCircle2 className="h-5 w-5 text-primary" />} />
        </div>
      </section>
      <section id="public-profile-badges-skills" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PublicProfileSectionPlaceholder title="Loading badge and skill lanes" />}>
          <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
            <GlowCard className="space-y-5">
              <div>
                <p className="text-xs font-medium text-primary">Badge showcase</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Top unlocked badges</h2>
              </div>
              <ul role="list" className="grid gap-3 sm:grid-cols-2">
                {data.user.badges.filter((badge) => badge.unlocked).slice(0, 4).map((badge) => (
                  <li key={badge.id} className="render-opt-card neon-surface rounded-[1.75rem] p-4">
                    <RarityBadge rarity={badge.rarity} />
                    <h3 className="mt-3 text-lg font-medium text-white">{badge.name}</h3>
                    <ExpandableText
                      text={badge.description}
                      lines={3}
                      minLengthForToggle={120}
                      className="mt-2"
                      textClassName="text-sm text-muted"
                      showMoreLabel="More"
                      showLessLabel="Less"
                    />
                  </li>
                ))}
              </ul>
            </GlowCard>
            <GlowCard className="space-y-5">
              <div>
                <p className="text-xs font-medium text-primary">Skill radar</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Strength map</h2>
              </div>
              <SkillRadarChart skills={data.user.skillTree} />
            </GlowCard>
          </div>
        </DeferUntilVisible>
      </section>
      <section id="public-profile-best-prs" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PublicProfileSectionPlaceholder title="Loading best PR battle reports" />}>
          <BestPRsPanel reports={data.featuredContributions} />
        </DeferUntilVisible>
      </section>
      <section id="public-profile-timeline-repos" className="render-opt-section scroll-mt-24">
        <DeferUntilVisible fallback={<PublicProfileSectionPlaceholder title="Loading timeline and repository lanes" />}>
          <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
            <GlowCard className="space-y-5">
              <div>
                <p className="text-xs font-medium text-primary">Contribution quality timeline</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{data.trendWindowLabel}</h2>
              </div>
              <TimelineChart data={data.user.xpTimeline} />
            </GlowCard>
            <GlowCard className="space-y-5">
              <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-primary">Top repositories</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Where recent contribution signal is strongest</h2>
              </div>
              <div className="space-y-3">
                {data.topRepositories.length === 0 ? (
                  <div className="neon-surface rounded-[1.5rem] border-dashed border-primary/24 px-4 py-3 text-sm text-muted">
                    <p>Repository-level signal is not available on this snapshot yet.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild variant="secondary" size="sm">
                        <a href="#public-profile-best-prs">Review best PR evidence</a>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <a href="#public-profile-overview">Back to profile summary</a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <ul role="list" className="space-y-3">
                    {data.topRepositories.slice(0, 4).map((repository, index) => (
                    <li key={`${repository.name}-${index}`} className="render-opt-card neon-surface rounded-[1.5rem] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="break-anywhere font-medium text-white">{repository.name}</p>
                          <p className="break-anywhere text-sm text-muted">
                            {repository.contributionCount} scored contributions
                            {repository.primarySkill ? ` • ${repository.primarySkill}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-medium text-primary">XP</p>
                          <p className="mt-1 text-lg font-semibold text-white">{repository.totalXp}</p>
                        </div>
                      </div>
                    </li>
                    ))}
                  </ul>
                )}
              </div>
            </GlowCard>
          </div>
        </DeferUntilVisible>
      </section>
    </div>
  );
}

function PublicProfileSectionPlaceholder({ title }: { title: string }) {
  return (
    <GlowCard className="space-y-4">
      <p className="text-xs font-medium text-primary">{title}</p>
      <div className="neon-skeleton h-8 w-2/3 rounded-[0.1rem]" />
      <div className="space-y-2">
        <div className="neon-skeleton h-4 w-full rounded-[0.1rem]" />
        <div className="neon-skeleton h-4 w-11/12 rounded-[0.1rem]" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="neon-skeleton h-24 rounded-[0.1rem]" />
        <div className="neon-skeleton h-24 rounded-[0.1rem]" />
      </div>
    </GlowCard>
  );
}

function ProofStripItem({
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
