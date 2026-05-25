import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, GitPullRequestArrow, ShieldCheck, Swords, Trophy } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";

const loop = [
  "Connect GitHub",
  "Analyze merged PRs",
  "Reveal rank",
  "Unlock badges",
  "Complete quests",
  "Share profile",
];

export function LandingPage() {
  return (
    <main className="space-y-8">
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
              <ul role="list" className="grid max-w-3xl gap-2 sm:grid-cols-3">
                <li className="list-none neon-surface px-3 py-2 text-xs text-muted">
                  Evidence-backed score movement
                </li>
                <li className="list-none neon-surface px-3 py-2 text-xs text-muted">
                  Real PR battle reports
                </li>
                <li className="list-none neon-surface px-3 py-2 text-xs text-muted">
                  Share-ready contributor profile
                </li>
              </ul>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/oauth/github/start?return_to=/dashboard" prefetch={false}>
                  Connect GitHub
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/onboarding/connect-github" prefetch={false}>See onboarding flow</Link>
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
            <div className="neon-surface rounded-3xl p-4">
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
              <TrustPill text="No synthetic production users." />
              <TrustPill text="Deterministic scoring owns rank authority." />
              <TrustPill text="Gemini only enriches explanations." />
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
          {[
          {
            icon: <ChartNoAxesCombined className="h-5 w-5 text-primary" />,
            title: "Skill needs evidence.",
            text: "Commits, stars, and streaks miss difficulty and real impact.",
          },
          {
            icon: <GitPullRequestArrow className="h-5 w-5 text-primary" />,
            title: "PRs carry different impact.",
            text: "A typo fix and a deep runtime patch deserve different score weight.",
          },
          {
            icon: <ShieldCheck className="h-5 w-5 text-primary" />,
            title: "Quality needs evidence.",
            text: "GitRank weights merged outcomes, review depth, tests, and repo context.",
          },
        ].map((item, index) => (
          <GlowCard key={`problem-card-${index}-${item.title}`} className="space-y-3">
            <div className="neon-tile inline-flex rounded-2xl p-3">{item.icon}</div>
            <h3 className="text-xl font-semibold text-white">{item.title}</h3>
            <p className="text-sm text-muted">{item.text}</p>
          </GlowCard>
        ))}
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
            {[
          {
            persona: "New contributor",
            mission: "Connect GitHub and unlock your first score snapshot.",
            success: "First synced PR appears with XP and evidence status.",
            href: "/onboarding/connect-github",
            cta: "Start onboarding",
          },
          {
            persona: "Returning contributor",
            mission: "Track weekly movement, quests, and impact quality.",
            success: "Rank movement updates after a merged high-signal PR.",
            href: "/dashboard/contributions",
            cta: "Open contributions",
          },
          {
            persona: "Profile sharer",
            mission: "Turn contribution history into a public credibility card.",
            success: "Public headline and share-ready profile card update.",
            href: "/dashboard",
            cta: "Open dashboard",
          },
          ].map((journey, index) => (
          <li key={`journey-${index}-${journey.persona}`}>
            <GlowCard className="space-y-3">
            <p className="text-xs font-medium text-primary">{journey.persona}</p>
            <h3 className="text-xl font-semibold text-white">{journey.mission}</h3>
            <p className="text-sm text-muted">{journey.success}</p>
            <Button asChild variant="secondary" size="sm">
              <Link href={journey.href} prefetch={false}>{journey.cta}</Link>
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
            {[
              "Classifies documentation, tests, bug fixes, backend, infra, performance, and architecture work.",
              "Turns verified work into XP, badge unlocks, league position, and public proof.",
              "Explains score changes so maintainers and recruiters can inspect the evidence instead of trusting a black box.",
            ].map((line, index) => (
              <li key={`solution-line-${index}`} className="list-none neon-surface rounded-3xl px-4 py-3 text-sm text-muted">
                {line}
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
            {loop.map((step, index) => (
              <li key={`loop-step-${index}`} className="neon-surface rounded-3xl p-4">
                <p className="text-xs font-medium text-primary">Step {index + 1}</p>
                <p className="mt-2 text-lg font-medium text-white">{step}</p>
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
          <div className="neon-tile rounded-[1.75rem] p-5">
            <p className="text-sm text-cyan-200">Live report cards unlock after OAuth and sync.</p>
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
            {[
              "Merged contribution cadence",
              "Review depth consistency",
              "Testing and reliability signal",
              "Cross-repository impact",
            ].map((track, index) => (
              <li key={`badge-track-${index}`} className="neon-surface rounded-[1.75rem] p-4">
                <p className="text-xs font-medium text-primary">Badge track</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{track}</h3>
              </li>
            ))}
          </ul>
        </GlowCard>
      </section>

      <section id="start-reveal" data-scroll-target="true" className="render-opt-section scroll-mt-24 grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <GlowCard className="space-y-4 border border-amber-400/18 bg-amber-400/6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-xs font-semibold text-amber-100">
            <Swords className="h-3.5 w-3.5" />
            Anti-spam promise
          </div>
            <h2 className="text-2xl font-semibold text-foreground">Spam PRs do not make you powerful here.</h2>
          <p className="readable-measure max-w-[68ch] text-sm leading-7 text-amber-50">
            Low-context noise, unreviewed changes, and thin contribution floods are scored down.
          </p>
        </GlowCard>

        <GlowCard strong className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/12 px-3 py-1.5 text-xs font-semibold text-primary">
              <Trophy className="h-3.5 w-3.5" />
              Ready to rank your work?
            </div>
            <h2 className="text-3xl font-semibold text-foreground">Build a profile maintainers and hiring teams can trust.</h2>
          </div>
          <Button asChild size="lg">
            <Link href="/oauth/github/start?return_to=/dashboard" prefetch={false}>Start the reveal</Link>
          </Button>
        </GlowCard>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="neon-metric rounded-3xl px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TrustPill({ text }: { text: string }) {
  return (
    <div className="neon-surface rounded-[1rem] px-3 py-2 text-xs text-muted">
      {text}
    </div>
  );
}
