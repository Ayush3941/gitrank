"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";
import { RouteLoadingState } from "@/components/shared/RouteLoadingState";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { StaleState } from "@/components/shared/StaleState";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";
import { useProfile } from "@/hooks/use-profile";
import { PublicProfileBadgesCard } from "@/features/profile/components/PublicProfileBadgesCard";
import { PublicProfileBestPRsSection } from "@/features/profile/components/PublicProfileBestPRsSection";
import { PublicProfileHero } from "@/features/profile/components/PublicProfileHero";
import { PublicProfileRepositoriesCard } from "@/features/profile/components/PublicProfileRepositoriesCard";
import { PublicProfileSkillCard } from "@/features/profile/components/PublicProfileSkillCard";
import { PublicProfileTimelineCard } from "@/features/profile/components/PublicProfileTimelineCard";
import {
  buildDeterministicIdentitySummary,
  deriveDeterministicArchetype,
} from "@/lib/ai/deterministic-identity-summary";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { normalizeDateTime } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { deduplicateSkillNodes } from "@/lib/presentation/skill-normalization";

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
    return buildAbraInsightsRequest({
      user: data?.user,
      contributions: data?.user.contributions ?? [],
      badges: visibleBadges,
      repositoriesTouched: data?.topRepositories.length ?? 0,
      streakDays: streak.currentStreakDays,
      enabled: !constrainedNetwork,
    });
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

  const profileRefreshTimestamp = normalizeDateTime(data.refreshedAt);

  return (
    <div className="stable-scroll-scope space-y-6">
      {data.isStale ? (
        <StaleState
          message={
            profileRefreshTimestamp ? (
              <>
                This profile snapshot was refreshed{" "}
                <RelativeTime
                  value={data.refreshedAt}
                  exactLabel="Profile snapshot refreshed"
                />
                .
              </>
            ) : (
              "This profile snapshot refresh time is unavailable."
            )
          }
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
        <PublicProfileBestPRsSection
          reports={data.featuredContributions}
          reportDetails={data.recentReports}
          constrainedNetwork={constrainedNetwork}
        />
      </section>
      <section
        id="public-profile-timeline-repos"
        data-scroll-target="true"
        className="render-opt-section space-y-4"
        aria-label="Timeline and repositories"
      >
        <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
          <PublicProfileTimelineCard
            timeline={data.user.xpTimeline}
            trendWindowLabel={data.trendWindowLabel}
            constrainedNetwork={constrainedNetwork}
          />
          <PublicProfileRepositoriesCard repositories={data.topRepositories} />
        </div>
      </section>
    </div>
  );
}
