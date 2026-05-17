"use client";

import Link from "next/link";
import { Crown, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { startTransition, type ReactNode, useEffect, useRef, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeGrid } from "@/features/badges/components/BadgeGrid";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useBadges } from "@/hooks/use-badges";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";
import { formatRelativeDays } from "@/lib/formatters";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { BadgeRarity } from "@/types/gitrank";

export function BadgesPageClient() {
  const { data, isLoading, isError, isFetching, refetch } = useBadges();
  const badgeViewedEventSent = useRef(false);
  const previousUnlockedCountRef = useRef<number | null>(null);
  const [rarity, setRarity] = useState<BadgeRarity | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Unlocked" | "Locked">("All");
  const [unlockNotice, setUnlockNotice] = useState("");
  const canResetFilters = rarity !== "All" || visibility !== "All";

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
  const streak = summarizeContributionStreak(profile?.user.contributions ?? []);

  const abraInsights = useAbraInsights(
    profile
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Badge shelf"
        description="Turn each unlocked badge into a story, track locked paths, and frame progression as a visible contributor journey."
        actions={(
          <Button asChild variant="secondary">
            <Link href="/dashboard/quests">Open quests</Link>
          </Button>
        )}
      />
      {profile?.user.syncStatus.state === "stale" ? (
        <StaleState
          message={`Badge snapshot refreshed ${formatRelativeDays(
            profile.refreshedAt,
          )}. New unlocks can appear after the next completed sync.`}
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
        <GlowCard strong className="cyber-hero-shell relative overflow-hidden">
          <div className="cyber-hero-overlay pointer-events-none absolute inset-0" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs tracking-[0.24em] text-fuchsia-100 uppercase">
                  <Trophy className="h-3.5 w-3.5" />
                  Achievement Forge
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-white">
                  {abraInsights.data?.archetype || "Systems Builder"} progression
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-200/84">
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
              <p className="text-xs tracking-[0.24em] text-cyan-200 uppercase">Badge lane progress</p>
              <Progress value={completionPercent} />
            </div>
            {unlockNotice ? (
              <p role="status" aria-live="polite" className="text-sm text-emerald-200">
                {unlockNotice}
              </p>
            ) : null}
          </div>
        </GlowCard>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-xs tracking-[0.2em] text-fuchsia-200 uppercase">
          Showing {filtered.length} of {totalCount} badges
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleResetFilters}
          disabled={!canResetFilters}
        >
          Reset filters
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={rarity} onValueChange={(value) => handleRarityChange(value as BadgeRarity | "All")}>
          <SelectTrigger aria-label="Filter by rarity">
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
          <SelectTrigger aria-label="Filter by unlock state">
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
          title="Your badge shelf is waiting."
          description="Complete your first meaningful merged PR to start unlocking visible reputation proof."
          actionLabel="Open quests"
          actionHref="/dashboard/quests"
          analyticsTarget="badges:empty"
        />
      ) : null}
      {!isLoading && !isError && filtered.length ? (
        <BadgeGrid
          badges={filtered}
          stories={abraInsights.data?.badgeStories}
        />
      ) : null}
      {!isLoading && !isError ? (
        <section className="space-y-3">
          <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">Locked / upcoming badges</p>
          {lockedBadges.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-3">
              {lockedBadges.map((badge) => (
                <div key={badge.id} className="neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4">
                  <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">{badge.rarity}</p>
                  <h3 className="mt-2 text-base font-semibold text-white">{badge.name}</h3>
                  <p className="mt-2 text-sm text-slate-300">{badge.unlockCondition}</p>
                  <div className="mt-3 space-y-1">
                    <Progress value={badge.progress ?? 0} />
                    <p className="text-xs text-slate-300">{badge.progress ?? 0}% verified progress</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="neon-surface rounded-[1.4rem] border-dashed border-fuchsia-300/32 px-4 py-4 text-sm text-slate-300">
              No locked badge definitions are currently returned by the backend profile snapshot.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
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
      <p className="text-[11px] tracking-[0.2em] text-slate-300 uppercase">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        {value}
        {icon}
      </p>
    </div>
  );
}
