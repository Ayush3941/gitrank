"use client";

import { Activity, Medal, ShieldCheck, Swords } from "lucide-react";
import { DashboardHeroRankCard } from "@/features/dashboard/components/DashboardHeroRankCard";
import { ContributionTimelineCard } from "@/features/dashboard/components/ContributionTimelineCard";
import { CurrentLeagueCard } from "@/features/dashboard/components/CurrentLeagueCard";
import { QuestPanel } from "@/features/dashboard/components/QuestPanel";
import { RecentBattleReports } from "@/features/dashboard/components/RecentBattleReports";
import { ScoreExplanationCard } from "@/features/dashboard/components/ScoreExplanationCard";
import { SkillBreakdownCard } from "@/features/dashboard/components/SkillBreakdownCard";
import { BadgeShelf } from "@/features/dashboard/components/BadgeShelf";
import { useDashboard } from "@/hooks/use-dashboard";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import { StatCard } from "@/components/shared/StatCard";
import type { PreviewMode } from "@/types/gitrank";

export function DashboardPageClient({ preview }: { preview?: PreviewMode }) {
  const { data, isLoading, isError } = useDashboard(preview);

  if (isLoading) {
    return <LoadingState message="Building your RPG dashboard..." />;
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Dashboard sync failed"
        description="GitHub rate limits or AI analysis delays can leave the dashboard partially unavailable. Retry or fall back to the last verified profile."
      />
    );
  }

  const { user, recentReports } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command center"
        description="Snapshot-based contribution analytics, progression, and score explanations weighted toward meaningful merged work."
      />
      {user.syncStatus.state === "stale" ? (
        <StaleState message="Your GitRank profile is 6 days old." />
      ) : null}
      <DashboardHeroRankCard user={user} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="GitRank score" value={user.gitRankScore} detail="Weighted by impact, reviews, tests, and repository context." icon={<Medal className="h-5 w-5 text-primary" />} />
        <StatCard label="Merged PRs" value={user.mergedPrCount} detail="Only verified merged work receives full progression value." icon={<ShieldCheck className="h-5 w-5 text-primary" />} />
        <StatCard label="Reviewed PRs" value={user.reviewedPrCount} detail="Review participation increases trust and unlocks deeper quests." icon={<Activity className="h-5 w-5 text-primary" />} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="space-y-6">
          <CurrentLeagueCard user={user} />
          <QuestPanel quests={user.quests} />
          <ScoreExplanationCard user={user} />
        </div>
        <div className="space-y-6">
          <SkillBreakdownCard user={user} />
          <RecentBattleReports reports={recentReports} />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <BadgeShelf user={user} />
        <ContributionTimelineCard user={user} />
      </div>
      <StatCard
        label="Anti-spam rule"
        value="Meaning over volume"
        detail="Spam PRs do not make you powerful here. Thin unreviewed work gets penalized or capped."
        icon={<Swords className="h-5 w-5 text-primary" />}
      />
    </div>
  );
}
