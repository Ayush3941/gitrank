import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, Star } from "lucide-react";
import { CopyTextButton } from "@/components/shared/CopyTextButton";
import { ExpandableText } from "@/components/shared/ExpandableText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { XPProgress } from "@/components/shared/XPProgress";
import { Button } from "@/components/ui/button";
import { uniqueDisplayValues } from "@/lib/display-values";
import type { Contribution, UserProfile } from "@/types/gitrank";

export function DashboardHeroRankCard({
  user,
  archetype,
  identitySummary,
  aiMode,
}: {
  user: UserProfile;
  archetype?: string;
  identitySummary?: string;
  aiMode?: "gemini" | "deterministic";
}) {
  const strongestSignals = uniqueDisplayValues(user.strongestSignals, 4);
  const nextAction =
    user.syncStatus.state !== "synced" || user.mergedPrCount === 0
      ? {
          title: "Refresh contribution evidence",
          description: "Open sync settings to refresh PR evidence before rank progression.",
          href: "/dashboard/settings",
          cta: "Open sync settings",
        }
      : user.quests.length > 0
        ? {
            title: "Continue active quest",
            description: "Quest completion is the fastest path to rank movement this cycle.",
            href: "/dashboard/quests",
            cta: "Open quests",
          }
        : {
            title: "Inspect contribution cards",
            description: "Review high-impact PR cards and keep evidence quality moving upward.",
            href: "/dashboard/contributions",
            cta: "Open contributions",
          };

  return (
    <GlowCard strong className="player-card-shell cyber-hero-shell space-y-6 overflow-hidden">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="rank-orbit rounded-[2rem] p-[2px]">
            <Image
              src={user.avatarUrl}
              alt={`${user.displayName} avatar`}
              width={72}
              height={72}
              sizes="72px"
              priority
              className="cyber-avatar h-[72px] w-[72px] rounded-[1.85rem]"
            />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="break-anywhere text-2xl font-semibold text-white">{user.displayName}</p>
              <RankBadge rank={user.level.rankTier} />
            </div>
            <p className="text-sm text-muted">@{user.username}</p>
            <p className="break-anywhere text-sm text-muted">
              {user.title}
              {archetype ? ` • ${archetype}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary">
            <Link href={`/u/${user.username}`} prefetch={false}>
              Public profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs font-medium text-primary">Level</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <span className="numeric-readout">{user.level.currentLevel.toLocaleString("en-US")}</span>
          </p>
        </div>
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs font-medium text-primary">Total XP</p>
          <p className="mt-3 text-4xl font-semibold text-white">
            <span className="numeric-readout">{user.level.currentXp.toLocaleString("en-US")}</span>
          </p>
        </div>
        <div className="neon-metric rounded-[1.75rem] p-5">
          <p className="text-xs font-medium text-primary">To next level</p>
          <p className="mt-3 text-lg font-medium text-white">
            <span className="numeric-readout">{Math.max(0, user.level.nextLevelXp - user.level.currentXp).toLocaleString("en-US")}</span> XP left
          </p>
          <p className="mt-2 text-sm text-muted">
            Target: <span className="numeric-readout">{user.level.nextLevelXp.toLocaleString("en-US")}</span> XP
          </p>
        </div>
      </div>
      <XPProgress current={user.level.currentXp} next={user.level.nextLevelXp} />
      <ContributionPulseStrip contributions={user.contributions} />
      <div className="rounded-[1.75rem] border border-emerald-400/16 bg-emerald-400/8 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 text-emerald-200" />
          <div>
            <p className="text-sm font-semibold text-white">Rank-up preview</p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {user.rankProgress.nextTier
                ? `${user.rankProgress.xpToNextTier.toLocaleString("en-US")} XP to ${user.rankProgress.nextTier}.`
                : "Already at top tier."}
            </p>
          </div>
        </div>
      </div>
      <div className="rounded-[1.75rem] border border-primary/18 bg-primary/8 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">{nextAction.title}</p>
            <p className="text-sm leading-6 text-muted">{nextAction.description}</p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href={nextAction.href} prefetch={false}>
              {nextAction.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      {identitySummary ? (
        <div className="rounded-[1.75rem] border border-cyan-300/20 bg-cyan-400/8 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-cyan-200">
              Identity brief ({aiMode === "gemini" ? "Gemini" : "Deterministic"})
            </p>
            <CopyTextButton
              text={identitySummary}
              label="Copy summary"
              copiedLabel="Summary copied"
              analyticsTarget="dashboard/identity-summary"
              size="sm"
              variant="ghost"
            />
          </div>
          <ExpandableText
            text={identitySummary}
            lines={4}
            minLengthForToggle={220}
            className="mt-2"
            textClassName="break-anywhere text-sm leading-6 text-muted"
          />
        </div>
      ) : null}
      <div className="space-y-3">
        <p className="text-xs font-medium text-primary">Top signals (latest evidence)</p>
        <ul role="list" className="flex flex-wrap gap-2">
          {strongestSignals.map((signal, index) => (
            <li key={`${signal}-${index}`} className="list-none">
              <span className="neon-chip neon-chip-muted inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm">
                <Star className="h-3.5 w-3.5 text-primary" />
                {signal}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlowCard>
  );
}

function ContributionPulseStrip({ contributions }: { contributions: Contribution[] }) {
  const cells = buildContributionPulse(contributions, 14);
  const activeDays = cells.filter((cell) => cell.count > 0).length;

  return (
    <div className="rounded-[1.75rem] border border-primary/16 bg-primary/6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-primary">14-day activity pulse</p>
        <p className="text-xs text-muted">
          {activeDays}/14 active days
        </p>
      </div>
      <ol role="list" className="mt-3 grid grid-cols-7 gap-1.5 sm:grid-cols-14">
        {cells.map((cell) => (
          <li key={cell.key} className="list-none">
            <span
              className={`block h-4 w-full rounded-[0.1rem] border ${intensityClasses(cell.count)} ${
                cell.isToday ? "ring-1 ring-primary/32 ring-offset-1 ring-offset-background" : ""
              }`}
              title={`${cell.label}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`}
              aria-label={`${cell.label}: ${cell.count} contribution${cell.count === 1 ? "" : "s"}`}
            />
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">
        Each tile represents one day of evidence-backed contribution activity.
      </p>
    </div>
  );
}

function buildContributionPulse(contributions: Contribution[], days: number) {
  const now = new Date();
  const today = startOfDay(now);
  const dayMillis = 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();

  for (const row of contributions) {
    const timestamp = Date.parse(row.mergedAt);
    if (Number.isNaN(timestamp)) {
      continue;
    }
    const day = startOfDay(new Date(timestamp));
    const key = day.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: Array<{
    key: string;
    label: string;
    count: number;
    isToday: boolean;
  }> = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * dayMillis);
    const key = day.toISOString().slice(0, 10);
    const count = counts.get(key) ?? 0;
    cells.push({
      key,
      label: day.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      count,
      isToday: offset === 0,
    });
  }

  return cells;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function intensityClasses(count: number): string {
  if (count >= 4) {
    return "border-cyan-300/65 bg-cyan-300/58";
  }
  if (count === 3) {
    return "border-cyan-300/52 bg-cyan-300/46";
  }
  if (count === 2) {
    return "border-cyan-300/42 bg-cyan-300/34";
  }
  if (count === 1) {
    return "border-cyan-300/32 bg-cyan-300/22";
  }
  return "border-primary/18 bg-primary/10";
}
