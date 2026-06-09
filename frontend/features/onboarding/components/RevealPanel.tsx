import { ArrowRight, Award, Sparkles } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { RankBadge } from "@/components/shared/RankBadge";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import { buildRevealPanelModel } from "@/features/onboarding/lib/reveal-panel-model";
import type { AbraInsightSource } from "@/lib/ai/abra-insights-types";
import { formatSyncStateLabel } from "@/lib/presentation/status-tone";
import type { UserProfile } from "@/types/gitrank";

const REVEAL_SKELETON_ROWS = [
  "rank-preview",
  "unlock-preview",
  "next-actions",
] as const;

export function RevealPanel({
  user,
  archetype,
  identitySummary,
  aiMode,
}: {
  user: UserProfile;
  archetype?: string;
  identitySummary?: string;
  aiMode?: AbraInsightSource;
}) {
  const reveal = buildRevealPanelModel({ user, aiMode });

  return (
    <div className="mx-auto max-w-5xl">
      <GlowCard strong className="relative space-y-8 overflow-hidden text-center">
        <OnboardingStepper currentStep="reveal" />
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
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
            This snapshot highlights recurring signals in {reveal.strongestSignalSummary} work.
          </p>
          <div className="mx-auto grid w-full max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reveal.metrics.map((metric) => (
              <RevealMetric key={metric.id} label={metric.label} value={metric.value} />
            ))}
          </div>
          <div className="mx-auto max-w-3xl rounded-[var(--radius-universal)] border border-primary/24 bg-primary/10 px-4 py-3 text-left text-sm text-foreground">
            <p className="text-xs font-medium text-primary">Snapshot state</p>
            <p className="mt-2 leading-6">
              Sync status is <span className="font-semibold text-white">{formatSyncStateLabel(reveal.effectiveSyncState)}</span>.
              {" "}
              {user.syncStatus.lastSyncedAt ? (
                <>
                  Last sync{" "}
                  <RelativeTime
                    value={user.syncStatus.lastSyncedAt}
                    fallback="time unavailable"
                    exactLabel="Last sync time"
                  />
                  .
                </>
              ) : null}
              {reveal.evidenceRowsLabel}
            </p>
          </div>
          {identitySummary ? (
            <div className="mx-auto max-w-3xl rounded-[var(--radius-universal)] border border-fuchsia-300/25 bg-fuchsia-400/9 px-4 py-3 text-left text-sm text-foreground">
              <p className="text-xs font-medium text-fuchsia-100">Identity summary ({reveal.aiSourceLabel})</p>
              <p className="mt-2 leading-6">{identitySummary}</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <RankBadge rank={user.level.rankTier} />
          <div className="neon-chip neon-chip-muted rounded-full px-4 py-2 text-sm text-muted">
            <span className="numeric-readout">{reveal.xpProgressLabel}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-white text-left">
                Unlock preview ({reveal.unlockPreviewLabel})
              </h2>
            </div>
            <ul id="reveal-unlock-preview" role="list" className="grid gap-4 sm:grid-cols-3">
              {reveal.unlockedBadges.length > 0 ? (
                reveal.unlockedBadges.map((badge) => (
                  <li key={badge.id} className="list-none rounded-[var(--radius-universal)] border border-cyan-300/16 bg-gradient-to-br from-slate-950/88 to-fuchsia-950/22 p-5 text-left">
                    <div className="flex items-center justify-between">
                      <Award className="h-5 w-5 text-primary" aria-hidden="true" />
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
                What to do next ({reveal.nextActions.length} steps)
              </h2>
            </div>
            <div id="reveal-next-actions" className="neon-surface rounded-[var(--radius-universal)] px-5 py-4 text-left">
              <ol className="mt-1 grid gap-3 sm:grid-cols-3">
                {reveal.nextActions.map((item, index) => (
                  <li key={item.id} className="neon-metric rounded-[var(--radius-universal)] px-3 py-3">
                    <p className="text-xs font-medium text-cyan-100">Step {index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {reveal.needsSyncRecovery ? (
            <Button asChild size="lg">
              <IntentPrefetchLink href="/onboarding/analyzing">
                {reveal.recoveryActionLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </IntentPrefetchLink>
            </Button>
          ) : null}
          <Button asChild size="lg" variant={reveal.needsSyncRecovery ? "secondary" : "default"}>
            <IntentPrefetchLink href="/dashboard">
              Enter dashboard
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </IntentPrefetchLink>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <IntentPrefetchLink href="/dashboard/contributions">Open contributions</IntentPrefetchLink>
          </Button>
          <ShareProfileButton
            variant="secondary"
            size="lg"
            username={user.username}
            displayName={user.displayName}
            shareHeadline={reveal.shareHeadline}
            analyticsTargetPrefix="onboarding-reveal"
          />
          <Button asChild variant="secondary" size="lg">
            <IntentPrefetchLink href={`/u/${user.username}`}>View public profile</IntentPrefetchLink>
          </Button>
        </div>
      </GlowCard>
    </div>
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
    <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3 text-left">
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
    <div className="rounded-[var(--radius-universal)] border border-dashed border-cyan-300/20 bg-gradient-to-br from-slate-950/82 to-cyan-950/20 p-5 text-left">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export function RevealPanelSkeleton() {
  return (
    <div className="mx-auto max-w-5xl">
      <GlowCard strong className="space-y-8 text-center">
        <OnboardingStepper currentStep="reveal" />
        <div className="neon-skeleton mx-auto h-8 w-48 rounded-full" />
        <div className="neon-skeleton mx-auto h-16 w-full max-w-2xl rounded-[var(--radius-universal)]" />
        <div className="neon-skeleton mx-auto h-10 w-72 rounded-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          {REVEAL_SKELETON_ROWS.map((rowId) => (
            <div key={rowId} className="neon-skeleton h-40 rounded-[var(--radius-universal)]" />
          ))}
        </div>
      </GlowCard>
    </div>
  );
}

export function RevealPanelUnavailable() {
  return (
    <div className="mx-auto max-w-3xl">
      <GlowCard strong className="space-y-6 text-center">
        <OnboardingStepper currentStep="connect" />
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-xs font-semibold text-amber-100">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Profile unavailable
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          Connect GitHub to reveal your first GitRank snapshot.
        </h1>
        <p className="text-sm text-muted">
          Reveal now reads the authenticated profile snapshot instead of static sample data. Start or refresh GitHub connection to generate the live view.
        </p>
        <Button asChild size="lg">
          <IntentPrefetchLink href="/oauth/github/start?return_to=/dashboard" prefetchMode="never">
            Connect GitHub
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </IntentPrefetchLink>
        </Button>
      </GlowCard>
    </div>
  );
}
