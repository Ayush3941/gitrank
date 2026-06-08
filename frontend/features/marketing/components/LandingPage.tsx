import {
  ArrowRight,
  ChartNoAxesCombined,
  Gauge,
  GitPullRequestArrow,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";
import type { ReactNode } from "react";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import {
  buildLandingPageModel,
  type LandingIconKey,
} from "@/features/marketing/lib/landing-page-model";

export function LandingPage() {
  const landing = buildLandingPageModel();

  return (
    <div className="space-y-8">
      <section className="glass-panel-strong overflow-hidden px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="cyber-title max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
                Turn open-source work into trusted reputation signals.
              </h1>
              <div className="flex flex-wrap gap-2">
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">For maintainers</span>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">For contributors</span>
                <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">For hiring teams</span>
              </div>
              <p className="cyber-copy readable-measure max-w-[72ch] text-base leading-8 sm:text-lg">
                GitRank scores PR difficulty, review depth, tests, and project context, then converts verified evidence into XP, badges, and shareable profile signals.
              </p>
              <div className="grid max-w-3xl gap-2 sm:grid-cols-3">
                <SignalChip icon={<Gauge className="h-3.5 w-3.5" aria-hidden="true" />} label="Deterministic score authority" />
                <SignalChip icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />} label="GitHub App token extraction" />
                <SignalChip icon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />} label="AI explanation-only layer" />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <IntentPrefetchLink
                  href="/oauth/github/start?return_to=/dashboard"
                  prefetchMode="never"
                >
                  Connect GitHub
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </IntentPrefetchLink>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <IntentPrefetchLink href="/onboarding/connect-github">See onboarding flow</IntentPrefetchLink>
              </Button>
            </div>
          </div>
          <GlowCard strong className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-primary">Live rank arena</p>
                <h2 className="cyber-title mt-2 text-2xl font-semibold text-foreground">After your first sync</h2>
              </div>
            </div>
            <div className="neon-surface rounded-[var(--radius-universal)] p-4">
              <p className="text-sm text-muted">
                Connect GitHub to unlock your real rank, profile card, and progression signals.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Difficulty" value="Scored" />
              <Metric label="Review depth" value="Weighted" />
              <Metric label="Tests" value="Verified" />
            </div>
            <div className="space-y-2">
              <AssuranceRow label="Identity" value="OAuth login only" />
              <AssuranceRow label="Extraction" value="GitHub App installation tokens" />
              <AssuranceRow label="Scoring" value="Deterministic formula first" />
            </div>
          </GlowCard>
        </div>
      </section>

      <section id="why-gitrank" data-scroll-target="true" className="render-opt-section scroll-mt-24">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Problem"
            title="Why GitRank exists"
            description="Contribution quality needs more than activity volume."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {landing.problemCards.map((item) => {
              const Icon = landingIconFor(item.icon);
              return (
                <GlowCard key={item.id} className="space-y-3">
                  <div className="neon-tile inline-flex rounded-[var(--radius-universal)] p-3">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-muted">{item.text}</p>
                </GlowCard>
              );
            })}
          </div>
        </div>
      </section>

      <section id="core-journeys" data-scroll-target="true" className="render-opt-section scroll-mt-24">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Journeys"
            title="Core user journeys"
            description="Onboarding, progression, and profile sharing."
          />
          <ul role="list" className="grid gap-6 lg:grid-cols-3">
            {landing.coreJourneys.map((journey) => (
              <li key={journey.id}>
                <GlowCard className="space-y-3">
                  <p className="text-xs font-medium text-primary">{journey.persona}</p>
                  <h3 className="text-xl font-semibold text-white">{journey.mission}</h3>
                  <p className="text-sm text-muted">{journey.success}</p>
                  <Button asChild variant="secondary" size="sm">
                    <IntentPrefetchLink href={journey.href}>{journey.cta}</IntentPrefetchLink>
                  </Button>
                </GlowCard>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="render-opt-section grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
        <GlowCard className="space-y-5">
          <SectionHeader
            eyebrow="Solution"
            title="Reputation from evidence-backed contribution scoring"
            description="Merged PR evidence flows into explainable score movement and inspectable profile snapshots."
          />
          <ul role="list" className="grid gap-3">
            {landing.solutionLines.map((line) => (
              <li key={line.id} className="list-none neon-surface rounded-[var(--radius-universal)] px-4 py-3 text-sm text-muted">
                {line.text}
              </li>
            ))}
          </ul>
        </GlowCard>

        <GlowCard strong className="space-y-5">
          <SectionHeader
            eyebrow="Gamified loop"
            title="A serious progression loop"
            description="RPG-style progression grounded in maintainers' evidence."
          />
          <ol className="grid gap-3 sm:grid-cols-2">
            {landing.loopSteps.map((step, index) => (
              <li key={step.id} className="neon-surface rounded-[var(--radius-universal)] p-4">
                <p className="text-xs font-medium text-primary">Step {index + 1}</p>
                <p className="mt-2 text-lg font-medium text-white">{step.label}</p>
              </li>
            ))}
          </ol>
        </GlowCard>
      </section>

      <section id="battle-reports" data-scroll-target="true" className="render-opt-section scroll-mt-24 grid gap-6 lg:grid-cols-[1.08fr,0.92fr]">
        <GlowCard className="space-y-5">
          <SectionHeader
            eyebrow="Battle report"
            title="Every high-signal PR gets a post-match report"
            description="Scoring stays explainable. High XP requires difficulty, context, and credible review signals."
          />
          <div className="neon-tile rounded-[var(--radius-universal)] p-5">
            <p className="text-sm text-cyan-200">Live report cards unlock after GitHub sign-in and app-backed sync.</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Report details appear once your profile sync completes.</h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Difficulty" value="Scored" />
              <Metric label="Impact" value="Explained" />
              <Metric label="Review depth" value="Verified" />
            </div>
          </div>
        </GlowCard>

        <GlowCard className="space-y-5">
          <SectionHeader
            eyebrow="Badge shelf"
            title="Visible milestones with signal-first design"
            description="Badges unlock from sustained evidence and meaningful activity."
          />
          <ul role="list" className="grid gap-3 sm:grid-cols-2">
            {landing.badgeTracks.map((track) => (
              <li key={track.id} className="neon-surface rounded-[var(--radius-universal)] p-4">
                <p className="text-xs font-medium text-primary">Badge track</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{track.title}</h3>
              </li>
            ))}
          </ul>
        </GlowCard>
      </section>

      <section id="start-reveal" data-scroll-target="true" className="render-opt-section scroll-mt-24 grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <GlowCard className="space-y-4 border border-amber-400/18 bg-amber-400/6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-xs font-semibold text-amber-100">
            <Swords className="h-3.5 w-3.5" aria-hidden="true" />
            Anti-spam promise
          </div>
          <h2 className="text-2xl font-semibold text-foreground">{landing.antiSpamPromise.title}</h2>
          <p className="readable-measure max-w-[68ch] text-sm leading-7 text-amber-50">
            {landing.antiSpamPromise.body}
          </p>
        </GlowCard>

        <GlowCard strong className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary">
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              Ready to rank your work?
            </div>
            <h2 className="text-3xl font-semibold text-foreground">Build a profile maintainers and hiring teams can trust.</h2>
          </div>
          <Button asChild size="lg">
            <IntentPrefetchLink
              href="/oauth/github/start?return_to=/dashboard"
              prefetchMode="never"
            >
              Start the reveal
            </IntentPrefetchLink>
          </Button>
        </GlowCard>
      </section>
    </div>
  );
}

function landingIconFor(icon: LandingIconKey) {
  if (icon === "chart") {
    return ChartNoAxesCombined;
  }
  if (icon === "pull-request") {
    return GitPullRequestArrow;
  }
  return ShieldCheck;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="neon-metric rounded-[var(--radius-universal)] px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SignalChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="neon-surface inline-flex items-center gap-2 px-3 py-2 text-xs text-muted">
      <span className="text-primary" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function AssuranceRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="neon-surface flex items-center justify-between gap-3 rounded-[var(--radius-universal)] px-3 py-2 text-xs">
      <span className="font-medium text-primary">{label}</span>
      <span className="text-muted">{value}</span>
    </div>
  );
}
