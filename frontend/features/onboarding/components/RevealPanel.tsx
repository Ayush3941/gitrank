import Link from "next/link";
import { ArrowRight, Award, Sparkles } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import { uniqueDisplayValues } from "@/lib/display-values";
import { formatRelativeDays } from "@/lib/formatters";
import { deduplicateBadgesByName } from "@/lib/presentation/badge-dedup";
import { formatSyncStateLabel } from "@/lib/presentation/status-tone";
import type { UserProfile } from "@/types/gitrank";

export function RevealPanel({
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
  const strongestSignalSummary =
    strongestSignals.length > 0 ? strongestSignals.join(", ") : "recent contribution";
  const unlockedBadges = deduplicateBadgesByName(user.badges)
    .filter((badge) => badge.unlocked)
    .slice(0, 3);
  const evidenceRows = user.contributions.length;
  const needsSyncRecovery =
    evidenceRows === 0 ||
    user.syncStatus.state === "never_synced" ||
    user.syncStatus.state === "partially_synced" ||
    user.syncStatus.state === "failed" ||
    user.syncStatus.state === "rate_limited";
  const recoveryActionLabel =
    user.syncStatus.state === "failed" || user.syncStatus.state === "rate_limited"
      ? "Retry sync analysis"
      : "Continue sync analysis";
  const nextActions =
    user.mergedPrCount === 0
      ? [
          "Merge your first meaningful PR so score movement can activate.",
          "Open sync settings to refresh and attach fresh GitHub evidence to this profile.",
          "Open quests to target your first high-signal contribution type.",
        ]
      : [
          "Open dashboard to inspect score movement and weekly XP.",
          "Review contribution drill-down for high-impact PR evidence cards.",
          "Share your public profile once privacy toggles are set.",
        ];

  return (
    <main className="mx-auto max-w-5xl">
      <GlowCard strong className="relative space-y-8 overflow-hidden text-center">
        <OnboardingStepper currentStep="reveal" />
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" />
            Analysis complete
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            Level {user.level.currentLevel} {user.title}
          </h1>
          <p className="mx-auto max-w-2xl text-sm text-cyan-100">
            GitRank has analyzed your open-source identity.
            {archetype ? ` Archetype: ${archetype}.` : ""}
          </p>
          <p className="mx-auto max-w-2xl text-base text-muted">
            This snapshot highlights recurring signals in {strongestSignalSummary} work.
          </p>
          <div className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <RevealMetric label="Merged PRs" value={user.mergedPrCount.toLocaleString("en-US")} />
            <RevealMetric label="Reviewed PRs" value={user.reviewedPrCount.toLocaleString("en-US")} />
            <RevealMetric label="Unlocked badges" value={unlockedBadges.length.toLocaleString("en-US")} />
            <RevealMetric label="Evidence rows" value={evidenceRows.toLocaleString("en-US")} />
          </div>
            <div className="mx-auto max-w-3xl rounded-2xl border border-primary/24 bg-primary/10 px-4 py-3 text-left text-sm text-foreground">
              <p className="text-xs font-medium text-primary">Snapshot state</p>
              <p className="mt-2 leading-6">
                Sync status is <span className="font-semibold text-white">{formatSyncStateLabel(user.syncStatus.state)}</span>.
                {" "}
                {user.syncStatus.lastSyncedAt ? `Last sync ${formatRelativeDays(user.syncStatus.lastSyncedAt)}.` : ""}
                {evidenceRows > 0
                ? ` This reveal includes ${evidenceRows} persisted contribution evidence row${evidenceRows === 1 ? "" : "s"}.`
                : " No scored contribution evidence is attached yet; merge one PR and re-sync to unlock deeper profile interpretation."}
              </p>
            </div>
          {identitySummary ? (
            <div className="mx-auto max-w-3xl rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/9 px-4 py-3 text-left text-sm text-foreground">
              <p className="text-xs font-medium text-fuchsia-100">Identity summary ({aiMode === "gemini" ? "Gemini" : "Deterministic"})</p>
              <p className="mt-2 leading-6">{identitySummary}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <RankBadge rank={user.level.rankTier} />
          <div className="neon-chip neon-chip-muted rounded-full px-4 py-2 text-sm text-muted">
            {user.level.currentXp} / {user.level.nextLevelXp} XP
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white text-left">
                Unlock preview ({unlockedBadges.length > 0 ? `${unlockedBadges.length} earned` : "next badge targets"})
              </h2>
            </div>
            <ul id="reveal-unlock-preview" role="list" className="grid gap-4 sm:grid-cols-3">
              {unlockedBadges.length > 0 ? (
                unlockedBadges.map((badge, index) => (
                  <li key={`${badge.id}-${index}`} className="list-none rounded-[1.75rem] border border-cyan-300/16 bg-gradient-to-br from-slate-950/88 to-fuchsia-950/22 p-5 text-left">
                    <div className="flex items-center justify-between">
                      <Award className="h-5 w-5 text-primary" />
                      <RarityBadge rarity={badge.rarity} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">{badge.name}</h3>
                    <p className="mt-2 text-sm text-muted">{badge.description}</p>
                  </li>
                ))
              ) : (
                <>
                  <li className="list-none"><RevealFallbackCard title="First merge unlock" body="Merge one PR to activate the first badge." /></li>
                  <li className="list-none"><RevealFallbackCard title="Review depth unlock" body="Maintainer-reviewed work speeds up trust and progression." /></li>
                  <li className="list-none"><RevealFallbackCard title="Consistency unlock" body="Sustained weekly contribution evidence unlocks rarer badge tiers." /></li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white text-left">
                What to do next ({nextActions.length} steps)
              </h2>
            </div>
            <div id="reveal-next-actions" className="neon-surface rounded-[1.75rem] px-5 py-4 text-left">
              <ol className="mt-1 grid gap-3 sm:grid-cols-3">
                {nextActions.map((item, index) => (
                  <li key={`${item}-${index}`} className="neon-metric rounded-[1.25rem] px-3 py-3">
                    <p className="text-xs font-medium text-cyan-100">Step {index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">{item}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {needsSyncRecovery ? (
            <Button asChild size="lg">
              <Link href="/onboarding/analyzing">
                {recoveryActionLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={needsSyncRecovery ? "secondary" : "default"}>
            <Link href="/dashboard" prefetch={false}>
              Enter dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/dashboard/contributions" prefetch={false}>Open contributions</Link>
          </Button>
          <ShareProfileButton
            variant="secondary"
            size="lg"
            username={user.username}
            displayName={user.displayName}
            shareHeadline={`${user.displayName} is ${user.title} on GitRank.`}
            analyticsTargetPrefix="onboarding-reveal"
          />
          <Button asChild variant="secondary" size="lg">
            <Link href={`/u/${user.username}`} prefetch={false}>View public profile</Link>
          </Button>
        </div>
      </GlowCard>
    </main>
  );
}

function RevealMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="neon-metric rounded-[1.35rem] px-4 py-3 text-left">
      <p className="text-xs font-medium text-cyan-100">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function RevealFallbackCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-cyan-300/20 bg-gradient-to-br from-slate-950/82 to-cyan-950/20 p-5 text-left">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export function RevealPanelSkeleton() {
  return (
    <main className="mx-auto max-w-5xl">
      <GlowCard strong className="space-y-8 text-center">
        <OnboardingStepper currentStep="reveal" />
        <div className="neon-skeleton mx-auto h-8 w-48 rounded-full" />
        <div className="neon-skeleton mx-auto h-16 w-full max-w-2xl rounded-3xl" />
        <div className="neon-skeleton mx-auto h-10 w-72 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item, index) => (
            <div key={`reveal-skeleton-${index}-${item}`} className="neon-skeleton h-40 rounded-[1.75rem]" />
          ))}
        </div>
      </GlowCard>
    </main>
  );
}

export function RevealPanelUnavailable() {
  return (
    <main className="mx-auto max-w-3xl">
      <GlowCard strong className="space-y-6 text-center">
        <OnboardingStepper currentStep="connect" />
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-xs font-semibold text-amber-100">
          <Sparkles className="h-3.5 w-3.5" />
          Profile unavailable
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Connect GitHub to reveal your first GitRank snapshot.
        </h1>
        <p className="text-sm text-muted">
          Reveal now reads the authenticated profile snapshot instead of static sample data. Start or refresh GitHub connection to generate the live view.
        </p>
        <Button asChild size="lg">
          <Link href="/oauth/github/start?return_to=/dashboard" prefetch={false}>
            Connect GitHub
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </GlowCard>
    </main>
  );
}
