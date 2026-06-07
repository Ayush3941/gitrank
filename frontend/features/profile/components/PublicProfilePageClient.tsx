"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { GlowCard } from "@/components/shared/GlowCard";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { StaleState } from "@/components/shared/StaleState";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfile } from "@/hooks/use-profile";
import { PublicProfileBadgesCard } from "@/features/profile/components/PublicProfileBadgesCard";
import { PublicProfileHero } from "@/features/profile/components/PublicProfileHero";
import { PublicProfileRepositoriesCard } from "@/features/profile/components/PublicProfileRepositoriesCard";
import { PublicProfileSkillCard } from "@/features/profile/components/PublicProfileSkillCard";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import {
  formatSignedNumber,
  formatSignedXp,
  formatXp,
  formatXpLabel,
} from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { formatContributionStatusLabel } from "@/lib/presentation/contribution-status";
import { deduplicateSkillNodes } from "@/lib/presentation/skill-normalization";

const TimelineChart = dynamic(
  () =>
    import("@/components/shared/TimelineChart").then(
      (mod) => mod.TimelineChart,
    ),
  {
    loading: () => <PublicLanePlaceholder label="Loading timeline" />,
  },
);

const BestPRsPanel = dynamic(
  () =>
    import("@/features/profile/components/BestPRsPanel").then(
      (mod) => mod.BestPRsPanel,
    ),
  {
    loading: () => <PublicLanePlaceholder label="Loading battle reports" />,
  },
);

const PUBLIC_PROFILE_SECTION_LINKS = [
  { id: "public-profile-overview", label: "Overview" },
  { id: "public-profile-badges-skills", label: "Badges & Skills" },
  { id: "public-profile-best-prs", label: "Best PRs" },
  { id: "public-profile-timeline-repos", label: "Timeline & Repos" },
];

export function PublicProfilePageClient({
  username,
}: {
  username: string;
}) {
  const constrainedNetwork = useNetworkConstraintPreference();
  const { data, isLoading, isError, isFetching, refetch } = useProfile(username);
  const visibleBadges = useMemo(
    () => deduplicateBadgesByName(data?.user.badges ?? []),
    [data?.user.badges],
  );
  const streak = summarizeContributionStreak(data?.user.contributions ?? []);
  const abraPayload = useMemo(() => {
    if (!data) {
      return null;
    }
    if (constrainedNetwork) {
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
        badgeCount: visibleBadges.filter((badge) => badge.unlocked).length,
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
      badges: visibleBadges.slice(0, 8).map((badge) => ({
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
  }, [constrainedNetwork, data, streak.currentStreakDays, visibleBadges]);
  const abraInsights = useAbraInsights(abraPayload);
  const fallbackArchetype = useMemo(
    () => (data ? deriveDeterministicArchetype(data.user.strongestSignals) : "Systems Builder"),
    [data],
  );
  const unlockedBadges = useMemo(
    () => visibleBadges.filter((badge) => badge.unlocked),
    [visibleBadges],
  );
  const skillTree = useMemo(
    () => deduplicateSkillNodes(data?.user.skillTree ?? []),
    [data?.user.skillTree],
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
  if (isLoading) {
    return (
      <RouteLoadingState
        eyebrow="Public profile"
        title="Contributor profile"
        description="Loading identity, skill signals, and public contribution evidence."
        cardCount={4}
        variant="profile"
      />
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Profile unavailable"
        description="The public profile is unavailable right now. Retry or open dashboard."
        onRetry={() => {
          void refetch();
        }}
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
        description="This profile is hidden, missing, or waiting for its first public GitRank score."
        actionLabel="Open dashboard"
        actionHref="/dashboard"
        analyticsTarget="public-profile:empty"
      />
    );
  }

  return (
    <div className="stable-scroll-scope space-y-6">
      {data.isStale ? (
        <StaleState
          message={(
            <>
              This profile snapshot was refreshed{" "}
              <RelativeTime
                value={data.refreshedAt}
                fallback="at an unknown time"
                exactLabel="Profile snapshot refreshed"
              />
              .
            </>
          )}
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
      <div className="flex flex-wrap items-center gap-2">
        <SnapshotFreshnessPill refreshedAt={data.refreshedAt} label="Refreshed" />
        <span
          className={
            data.partialProfileAvailable
              ? "rounded-full border border-amber-400/24 bg-amber-400/12 px-3 py-1 text-xs font-semibold text-amber-100"
              : "neon-chip neon-chip-success rounded-full px-3 py-1 text-xs font-semibold"
          }
        >
          {data.partialProfileAvailable ? "Partial evidence mode" : "Fresh snapshot"}
        </span>
      </div>
      <InPageSectionNav sections={PUBLIC_PROFILE_SECTION_LINKS} className="render-opt-section" />
      <section
        id="public-profile-overview"
        data-scroll-target="true"
        className="space-y-6"
      >
        <PublicProfileHero
          user={data.user}
          shareHeadline={data.shareHeadline}
          archetype={abraInsights.data?.archetype ?? fallbackArchetype}
          identitySummary={abraInsights.data?.identitySummary ?? fallbackIdentitySummary}
          identitySummaryMode={abraInsights.data?.generatedBy ?? "deterministic"}
        />
      </section>
      <section
        id="public-profile-badges-skills"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
        aria-label="Badges and skills"
      >
        <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
          <PublicProfileBadgesCard badges={unlockedBadges} />
          <PublicProfileSkillCard skills={skillTree} constrainedNetwork={constrainedNetwork} />
        </div>
      </section>
      <section
        id="public-profile-best-prs"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
        aria-label="Top PR battle reports"
      >
        {constrainedNetwork ? (
          <LiteBestPRSummary reports={data.featuredContributions} />
        ) : (
          <DeferUntilVisible fallback={<PublicLanePlaceholder label="Loading battle reports" />}>
            <BestPRsPanel reports={data.featuredContributions} reportDetails={data.recentReports} />
          </DeferUntilVisible>
        )}
      </section>
      <section
        id="public-profile-timeline-repos"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
        aria-label="Timeline and repositories"
      >
        <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
          <GlowCard className="space-y-5">
            <div>
              <p className="text-xs font-medium text-primary">Timeline</p>
              <h2 className="mt-2 text-xl font-semibold text-white">XP timeline</h2>
              <p className="mt-1 text-sm text-muted">{data.trendWindowLabel}</p>
            </div>
            {data.user.xpTimeline.length === 0 ? (
              <CompactEmptyState
                title="No timeline signal yet"
                description="Timeline signal appears here after more scored history is synced."
                primaryAction={{
                  label: "Open contributions",
                  href: "/dashboard/contributions",
                  prefetchMode: "never",
                }}
              />
            ) : constrainedNetwork ? (
              <LiteTimelineSummary timeline={data.user.xpTimeline} />
            ) : (
              <DeferUntilVisible fallback={<PublicLanePlaceholder label="Loading timeline" />}>
                <TimelineChart data={data.user.xpTimeline} />
              </DeferUntilVisible>
            )}
          </GlowCard>
          <PublicProfileRepositoriesCard repositories={data.topRepositories} />
        </div>
      </section>
    </div>
  );
}

function LiteTimelineSummary({
  timeline,
}: {
  timeline: Array<{ label: string; xp: number }>;
}) {
  if (timeline.length === 0) {
    return (
      <CompactEmptyState
        title="No timeline signal yet"
        description="Timeline signal appears here after more scored history is synced."
      />
    );
  }

  const recent = timeline.slice(-6);
  const first = recent[0];
  const latest = recent[recent.length - 1];
  const previous = recent.length > 1 ? recent[recent.length - 2] : null;
  const delta = previous ? latest.xp - previous.xp : 0;
  const windowDelta = latest.xp - first.xp;
  const momentumLabel = delta > 0 ? "Rising" : delta < 0 ? "Cooling" : "Flat";

  return (
    <div className="space-y-3">
      <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">Latest XP snapshot</p>
          <span className="neon-chip neon-chip-muted rounded-full px-2.5 py-1 text-xs font-semibold">
            {momentumLabel}
          </span>
        </div>
        <p className="mt-1 text-lg font-semibold text-white">
          {formatXpLabel(latest.xp)}
        </p>
        <p className="mt-1 text-xs text-muted">
          {latest.label}
          {previous ? ` • ${formatSignedNumber(delta)} vs previous` : ""}
        </p>
        <p className="mt-1 text-xs text-muted">
          Recent window change: {formatSignedXp(windowDelta)}
        </p>
      </div>
      <ul role="list" className="space-y-2">
        {recent.map((point, index) => (
          <li
            key={`${point.label}-${index}`}
            className="neon-surface flex items-center justify-between gap-3 rounded-[var(--radius-universal)] px-4 py-2.5"
          >
            <p className="text-sm text-muted">{point.label}</p>
            <p className="text-sm font-semibold text-white">{formatXp(point.xp)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiteBestPRSummary({
  reports,
}: {
  reports: Array<{
    id: string;
    owner: string;
    repo: string;
    number: number;
    title: string;
    xpEarned: number;
    status: string;
  }>;
}) {
  if (reports.length === 0) {
    return (
      <GlowCard className="space-y-3">
        <CompactEmptyState
          title="No public battle reports yet"
          description="This profile snapshot has no visible battle reports yet."
          primaryAction={{
            label: "Open contributions",
            href: "/dashboard/contributions",
            prefetchMode: "never",
          }}
        />
      </GlowCard>
    );
  }

  return (
    <GlowCard className="space-y-4">
      <ul role="list" className="space-y-3">
        {reports.slice(0, 4).map((report) => (
          <li
            key={report.id}
            className="neon-surface rounded-[var(--radius-universal)] px-4 py-3"
          >
            <p className="break-anywhere text-sm font-medium text-white">{report.title}</p>
            <p className="mt-1 break-anywhere text-xs text-muted">
              {report.owner}/{report.repo} #{report.number} • {formatContributionStatusLabel(report.status)}
            </p>
            <p className="mt-2 text-xs font-semibold text-primary">{formatSignedXp(report.xpEarned)}</p>
          </li>
        ))}
      </ul>
    </GlowCard>
  );
}

function PublicLanePlaceholder({ label }: { label: string }) {
  return (
    <PanelLoadingPlaceholder
      label={label}
      minHeightClassName="min-h-[16rem]"
      skeletons={[
        { className: "h-10 w-2/5" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
