"use client";

import { Crown, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { GlowCard } from "@/components/shared/GlowCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeGrid } from "@/features/badges/components/BadgeGrid";
import { useAbraInsights } from "@/hooks/use-abra-insights";
import { useBadges } from "@/hooks/use-badges";
import { summarizeContributionStreak } from "@/lib/metrics/contribution-metrics";
import type { BadgeRarity } from "@/types/gitrank";

const upcomingBadgeTemplates = [
  {
    id: "legendary-maintainer-lane",
    name: "Legendary Maintainer Lane",
    rarity: "Legendary",
    unlockCondition: "Land high-quality contributions across 3 repositories in one season.",
  },
  {
    id: "mythic-system-architect",
    name: "Mythic System Architect",
    rarity: "Mythic",
    unlockCondition: "Sustain architecture + reliability signal for 8+ weeks.",
  },
  {
    id: "epic-review-commander",
    name: "Epic Review Commander",
    rarity: "Epic",
    unlockCondition: "Demonstrate deep review participation with accepted feedback loops.",
  },
] as const;

export function BadgesPageClient() {
  const { data, isLoading, isError } = useBadges();
  const [rarity, setRarity] = useState<BadgeRarity | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Unlocked" | "Locked">("All");

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Badge shelf"
        description="Turn each unlocked badge into a story, track locked paths, and frame progression as a visible contributor journey."
      />
      {!isLoading && !isError && profile ? (
        <GlowCard strong className="relative overflow-hidden border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500/12 via-slate-900/84 to-cyan-500/10">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(56,189,248,0.08)_50%,transparent_100%)]" />
          <div className="relative space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-fuchsia-300/30 bg-fuchsia-400/10 px-3 py-1 text-xs tracking-[0.24em] text-fuchsia-200 uppercase">
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
              <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
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
          </div>
        </GlowCard>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={rarity} onValueChange={(value) => setRarity(value as BadgeRarity | "All")}>
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
        <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}>
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
        />
      ) : null}
      {!isLoading && !isError && filtered.length === 0 ? (
        <EmptyState
          title="Your badge shelf is waiting."
          description="Complete your first meaningful merged PR to start unlocking visible reputation proof."
          actionLabel="Open quests"
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
          <div className="grid gap-3 md:grid-cols-3">
            {upcomingBadgeTemplates.map((badge, index) => {
              const progress = Math.min(
                92,
                Math.max(5, Math.round((profile?.user.level.currentLevel ?? 1) * 9 + index * 13)),
              );
              return (
                <div key={badge.id} className="rounded-[1.4rem] border border-dashed border-fuchsia-300/28 bg-fuchsia-950/20 px-4 py-4">
                  <p className="text-xs tracking-[0.24em] text-fuchsia-200 uppercase">{badge.rarity}</p>
                  <h3 className="mt-2 text-base font-semibold text-white">{badge.name}</h3>
                  <p className="mt-2 text-sm text-slate-300">{badge.unlockCondition}</p>
                  <p className="mt-3 text-xs text-cyan-200">How to unlock: keep weekly evidence momentum in this lane.</p>
                  <div className="mt-3 space-y-1">
                    <Progress value={progress} />
                    <p className="text-xs text-slate-300">{progress}% projected progress</p>
                  </div>
                </div>
              );
            })}
          </div>
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
    <div className="rounded-[1.4rem] border border-white/12 bg-black/25 px-4 py-3">
      <p className="text-[11px] tracking-[0.2em] text-slate-300 uppercase">{label}</p>
      <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        {value}
        {icon}
      </p>
    </div>
  );
}
