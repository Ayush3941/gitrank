"use client";

import Link from "next/link";
import { Crown, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";
import { startTransition, type ReactNode, useEffect, useRef, useState } from "react";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { ConstrainedNetworkPill } from "@/components/shared/ConstrainedNetworkPill";
import { DeferUntilVisible } from "@/components/shared/DeferUntilVisible";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SectionJumpNav } from "@/components/shared/SectionJumpNav";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";
import { StaleState } from "@/components/shared/StaleState";
import { SyncStateGuide, shouldShowSyncStateGuide } from "@/components/shared/SyncStateGuide";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeGrid } from "@/features/badges/components/BadgeGrid";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useBadges } from "@/hooks/use-badges";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import {
  deriveDeterministicArchetype,
  shouldRequestAbraInsights,
} from "@/lib/ai/deterministic-identity-summary";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import { initialSectionFromHash } from "@/lib/section-nav";
import type { BadgeRarity } from "@/types/gitrank";

type BadgeSectionId = "badges-forge" | "badges-earned" | "badges-locked";

const BADGE_SECTION_ITEMS: Array<{ id: BadgeSectionId; label: string }> = [
  { id: "badges-forge", label: "Forge" },
  { id: "badges-earned", label: "Earned" },
  { id: "badges-locked", label: "Locked" },
];
const BADGE_SECTION_IDS = BADGE_SECTION_ITEMS.map((section) => section.id) as BadgeSectionId[];
const BADGE_DEFAULT_SECTION: BadgeSectionId = "badges-forge";

export function BadgesPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useBadges();
  const badgeViewedEventSent = useRef(false);
  const previousUnlockedCountRef = useRef<number | null>(null);
  const [activeSection, setActiveSection] = useState<BadgeSectionId>(BADGE_DEFAULT_SECTION);
  const [rarity, setRarity] = useState<BadgeRarity | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Unlocked" | "Locked">("All");
  const [unlockNotice, setUnlockNotice] = useState("");
  const canResetFilters = rarity !== "All" || visibility !== "All";
  const badgesFilterStatusId = "badges-filter-status";

  const filtered =
    data?.badges.filter((badge) => {
      const rarityMatch = rarity === "All" || badge.rarity === rarity;
      const visibilityMatch =
        visibility === "All" ||
        (visibility === "Unlocked" && badge.unlocked) ||
        (visibility === "Locked" && !badge.unlocked);
      return rarityMatch && visibilityMatch;
    }) ?? [];
  const profile = data?.profile;
  const lockedBadges = data?.badges.filter((badge) => !badge.unlocked) ?? [];
  const unlockedCount = data?.badges.filter((badge) => badge.unlocked).length ?? 0;
  const totalCount = data?.badges.length ?? 0;
  const completionPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;
  const activeSectionLabel =
    BADGE_SECTION_ITEMS.find((section) => section.id === activeSection)?.label ?? "Forge";
  const activeSectionLink = `/dashboard/badges#${activeSection}`;
  const streak = summarizeContributionStreak(profile?.user.contributions ?? []);
  const nextUnlockTarget = lockedBadges.length
    ? [...lockedBadges].sort((left, right) => (right.progress ?? 0) - (left.progress ?? 0))[0]
    : null;

  const abraInsights = useAbraInsights(
    profile &&
      shouldRequestAbraInsights({
        showAiSummaries: profile.user.privacy.showAiSummaries !== false,
        mergedPrCount: profile.user.mergedPrCount,
        contributionCount: profile.user.contributions.length,
      })
      ? {
          profile: {
            username: profile.user.username,
            displayName: profile.user.displayName,
            currentTitle: profile.user.title,
            rankTier: profile.user.level.rankTier,
            level: profile.user.level.currentLevel,
            totalXp: profile.user.level.currentXp,
            mergedPrCount: profile.user.mergedPrCount,
            strongestSignals: profile.user.strongestSignals,
            repositoriesTouched: profile.topRepositories.length,
            badgeCount: unlockedCount,
            streakDays: streak.currentStreakDays,
          },
          contributions: profile.user.contributions.slice(0, 8).map((row) => ({
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
          badges: filtered.slice(0, 10).map((badge) => ({
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
        }
      : null,
  );
  const fallbackArchetype = profile
    ? deriveDeterministicArchetype(profile.user.strongestSignals)
    : "Systems Builder";

  useEffect(() => {
    if (isLoading || isError || !data || badgeViewedEventSent.current) {
      return;
    }
    badgeViewedEventSent.current = true;
    void emitAnalyticsEvent({
      eventName: "badge.viewed",
      source: "frontend",
      target: "dashboard/badges",
      status: "success",
    });
  }, [data, isError, isLoading]);

  useEffect(() => {
    if (isLoading || isError || !data) {
      return;
    }
    const previous = previousUnlockedCountRef.current;
    previousUnlockedCountRef.current = unlockedCount;
    if (previous === null || unlockedCount <= previous) {
      return;
    }
    const delta = unlockedCount - previous;
    setUnlockNotice(
      delta === 1
        ? "Badge unlocked. Your shelf gained 1 new achievement."
        : `Badges unlocked. Your shelf gained ${delta} new achievements.`,
    );
  }, [data, isError, isLoading, unlockedCount]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      const nextSection = initialSectionFromHash(
        BADGE_SECTION_IDS,
        BADGE_DEFAULT_SECTION,
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
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) {
          return;
        }
        const nextSection = initialSectionFromHash(
          BADGE_SECTION_IDS,
          BADGE_DEFAULT_SECTION,
          `#${visible.target.id}`,
        );
        setActiveSection((previous) => (previous === nextSection ? previous : nextSection));
      },
      { rootMargin: "-25% 0px -55% 0px", threshold: [0.25, 0.45, 0.7] },
    );

    BADGE_SECTION_ITEMS.forEach(({ id }) => {
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

  function handleRarityChange(value: BadgeRarity | "All") {
    startTransition(() => setRarity(value));
  }

  function handleVisibilityChange(value: "All" | "Unlocked" | "Locked") {
    startTransition(() => setVisibility(value));
  }

  function handleResetFilters() {
    startTransition(() => {
      setRarity("All");
      setVisibility("All");
    });
  }

  function handleClearRarityFilter() {
    startTransition(() => {
      setRarity("All");
    });
  }

  function handleClearVisibilityFilter() {
    startTransition(() => {
      setVisibility("All");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Badges"
        title="Badge shelf"
        description="Turn each unlocked badge into a story, track locked paths, and frame progression as a visible contributor journey."
        meta={
          <>
            <SnapshotFreshnessPill
              refreshedAt={profile?.refreshedAt}
              label="Badge snapshot"
            />
            <ConstrainedNetworkPill />
          </>
        }
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/quests">Open quests</Link>
          </Button>
        )}
      />
      {profile && shouldShowSyncStateGuide(profile.user.syncStatus) ? (
        <SyncStateGuide
          status={profile.user.syncStatus}
          className="render-opt-section border-primary/24 bg-primary/8"
        />
      ) : null}
      <SectionJumpNav
        navLabelID="badges-jump-nav-label"
        landmarkLabel="Badges section navigation"
        activeSectionLabel={activeSectionLabel}
        items={BADGE_SECTION_ITEMS}
        activeSection={activeSection}
        onSectionSelect={setActiveSection}
        copyHref={activeSectionLink}
        copyAnalyticsTarget="badges/copy-section-link"
      />
      <section id="badges-forge" className="render-opt-section scroll-mt-24 space-y-4">
        {profile?.user.syncStatus.state === "stale" ? (
          <StaleState
            message={`Badge snapshot refreshed ${formatRelativeDays(
              profile.refreshedAt,
            )}. New unlocks can appear after the next completed sync.`}
            updatedAt={profile.refreshedAt}
            onRefresh={() => {
              void refetch();
            }}
            isRefreshing={isFetching}
            actionLabel="Open settings"
            actionHref="/dashboard/settings"
            analyticsTarget="badges:stale"
          />
        ) : null}
        {!isLoading && !isError && profile ? (
          <DeferUntilVisible fallback={<BadgeSectionPlaceholder title="Loading badge forge" />}>
            <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-fuchsia-100">
                      <Trophy className="h-3.5 w-3.5" />
                      Achievement Forge
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold text-white">
                      {abraInsights.data?.archetype ?? fallbackArchetype} progression
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm text-muted">
                      {abraInsights.data?.identitySummary ||
                        "Badge narratives are running in deterministic fallback mode."}
                    </p>
                  </div>
                  <div className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs">
                    <Sparkles className="h-3.5 w-3.5" />
                    {abraInsights.data?.generatedBy === "gemini"
                      ? "Gemini achievement stories"
                      : "Deterministic achievement stories"}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <BadgeMetric label="Unlocked" value={unlockedCount} icon={<ShieldCheck className="h-4 w-4 text-cyan-200" />} />
                  <BadgeMetric label="Completion" value={`${completionPercent}%`} icon={<Crown className="h-4 w-4 text-fuchsia-200" />} />
                  <BadgeMetric label="Level" value={profile.user.level.currentLevel} icon={<Trophy className="h-4 w-4 text-violet-200" />} />
                  <BadgeMetric label="Current streak" value={`${streak.currentStreakDays}d`} icon={<Sparkles className="h-4 w-4 text-emerald-200" />} />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-cyan-200">Badge lane progress</p>
                  <Progress value={completionPercent} />
                </div>
                {unlockNotice ? (
                  <p role="status" aria-live="polite" className="text-sm text-emerald-200">
                    {unlockNotice}
                  </p>
                ) : null}
                {nextUnlockTarget ? (
                  <div className="neon-surface space-y-3 border border-primary/22 px-4 py-4">
                    <p className="text-xs font-medium text-primary">Closest next unlock</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-white">{nextUnlockTarget.name}</p>
                        <p className="mt-1 text-sm text-muted">
                          {nextUnlockTarget.progress ?? 0}% complete • {nextUnlockTarget.rarity}
                        </p>
                      </div>
                      <Button asChild variant="secondary" size="sm">
                        <Link href={unlockRecoveryHref(nextUnlockTarget.unlockCondition)}>
                          {unlockRecoveryLabel(nextUnlockTarget.unlockCondition)}
                        </Link>
                      </Button>
                    </div>
                    <ExpandableText
                      text={nextUnlockTarget.unlockCondition}
                      lines={3}
                      minLengthForToggle={140}
                      textClassName="text-sm text-muted"
                      showMoreLabel="Read unlock path"
                      showLessLabel="Hide unlock path"
                    />
                  </div>
                ) : null}
              </div>
            </GlowCard>
          </DeferUntilVisible>
        ) : null}
      </section>
      <section id="badges-earned" className="render-opt-section scroll-mt-24 space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-fuchsia-100">Filter controls</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id={badgesFilterStatusId} role="status" aria-live="polite" className="text-sm text-fuchsia-100">
              Showing {filtered.length} of {totalCount} badges
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {rarity !== "All" ? (
                <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                  Rarity: {rarity}
                  <button
                    type="button"
                    onClick={handleClearRarityFilter}
                    className="focus-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-primary/30 px-1 text-xs leading-none text-cyan-100 hover:bg-primary/14"
                    aria-label="Clear badge rarity filter"
                    title="Clear rarity filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
              {visibility !== "All" ? (
                <span className="neon-chip neon-chip-muted inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold">
                  State: {visibility}
                  <button
                    type="button"
                    onClick={handleClearVisibilityFilter}
                    className="focus-ring inline-flex min-h-6 min-w-6 items-center justify-center rounded-full border border-primary/30 px-1 text-xs leading-none text-cyan-100 hover:bg-primary/14"
                    aria-label="Clear badge visibility filter"
                    title="Clear visibility filter"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : null}
              {!canResetFilters ? (
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                  No active filters
                </span>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetFilters}
                disabled={!canResetFilters}
                title={canResetFilters ? "Reset active filters" : "No filters to reset"}
              >
                Reset filters
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Select value={rarity} onValueChange={(value) => handleRarityChange(value as BadgeRarity | "All")}>
            <SelectTrigger aria-label="Filter by rarity" aria-describedby={badgesFilterStatusId}>
              <SelectValue placeholder="Filter by rarity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All rarities</SelectItem>
              {["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"].map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={visibility} onValueChange={(value) => handleVisibilityChange(value as typeof visibility)}>
            <SelectTrigger aria-label="Filter by unlock state" aria-describedby={badgesFilterStatusId}>
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All badges</SelectItem>
              <SelectItem value="Unlocked">Unlocked</SelectItem>
              <SelectItem value="Locked">Locked</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isLoading ? <LoadingState message="Polishing your badge shelf..." /> : null}
        {isError ? (
          <ErrorState
            title="Badge sync failed"
            description="Some badge evidence could not be verified from GitHub. Retry sync or use partial profile data."
            fallbackLabel="Open settings"
            fallbackHref="/dashboard/settings"
            analyticsTarget="badges:error"
          />
        ) : null}
        {!isLoading && !isError && filtered.length === 0 ? (
          <EmptyState
            eyebrow={canResetFilters && totalCount > 0 ? "Filter results" : "Badge progression"}
            title={
              canResetFilters && totalCount > 0
                ? "No badges match current filters."
                : "Your badge shelf is waiting."
            }
            description={
              canResetFilters && totalCount > 0
                ? "Reset filters to view all earned and locked lanes, or choose a wider rarity/state range."
                : "Complete your first meaningful merged PR to start unlocking visible reputation proof."
            }
            actionLabel={canResetFilters && totalCount > 0 ? "Reset filters" : "Open quests"}
            actionHref={canResetFilters && totalCount > 0 ? undefined : "/dashboard/quests"}
            onAction={canResetFilters && totalCount > 0 ? handleResetFilters : undefined}
            secondaryActionLabel="Open contributions"
            secondaryActionHref="/dashboard/contributions"
            analyticsTarget={
              canResetFilters && totalCount > 0 ? "badges:empty-filtered" : "badges:empty"
            }
          />
        ) : null}
        {!isLoading && !isError && filtered.length ? (
          <DeferUntilVisible fallback={<BadgeSectionPlaceholder title="Loading earned badge cards" />}>
            <BadgeGrid
              badges={filtered}
              stories={abraInsights.data?.badgeStories}
            />
          </DeferUntilVisible>
        ) : null}
      </section>
      {!isLoading && !isError ? (
        <section id="badges-locked" className="render-opt-section scroll-mt-24 space-y-3">
          <p className="text-xs font-medium text-fuchsia-200">Locked / upcoming badges</p>
          <DeferUntilVisible fallback={<BadgeSectionPlaceholder title="Loading locked badge lanes" />}>
            {lockedBadges.length > 0 ? (
              <ul role="list" className="grid gap-3 md:grid-cols-3">
                {lockedBadges.map((badge) => (
                  <li key={badge.id} className="render-opt-card neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4">
                    <p className="text-xs font-medium text-fuchsia-200">{badge.rarity}</p>
                    <h3 className="mt-2 text-base font-semibold text-white">{badge.name}</h3>
                    <ExpandableText
                      text={badge.unlockCondition}
                      lines={3}
                      minLengthForToggle={120}
                      className="mt-2"
                      textClassName="text-sm text-muted"
                      showMoreLabel="Expand condition"
                      showLessLabel="Collapse condition"
                    />
                    <div className="mt-3 space-y-1">
                      <Progress value={badge.progress ?? 0} />
                      <p className="text-xs text-muted">{badge.progress ?? 0}% verified progress</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-cyan-100/88">
                        Next move: {unlockRecoveryLabel(badge.unlockCondition)}
                      </p>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={unlockRecoveryHref(badge.unlockCondition)}>Open lane</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4 text-sm text-muted">
                No locked badge definitions are currently returned by the backend profile snapshot.
              </div>
            )}
          </DeferUntilVisible>
        </section>
      ) : null}
    </div>
  );
}

function BadgeSectionPlaceholder({ title }: { title: string }) {
  return (
    <GlowCard className="glass-panel cyber-card cyber-frame flex min-h-[11rem] items-center justify-center p-4">
      <p className="text-sm text-muted">{title}</p>
    </GlowCard>
  );
}

function unlockRecoveryHref(condition: string): string {
  const text = condition.toLowerCase();
  if (
    text.includes("streak")
    || text.includes("weekly")
    || text.includes("daily")
    || text.includes("quest")
  ) {
    return "/dashboard/quests";
  }
  return "/dashboard/contributions";
}

function unlockRecoveryLabel(condition: string): string {
  const text = condition.toLowerCase();
  if (
    text.includes("streak")
    || text.includes("weekly")
    || text.includes("daily")
    || text.includes("quest")
  ) {
    return "Open quest lane";
  }
  return "Open contribution lane";
}

function BadgeMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="neon-metric rounded-[1.4rem] px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        {value}
        {icon}
      </p>
    </div>
  );
}
