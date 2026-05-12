import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, GitPullRequestArrow, ShieldCheck, Sparkles, Swords, Trophy } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { RarityBadge } from "@/components/shared/RarityBadge";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Button } from "@/components/ui/button";
import { marketingSample } from "@/features/marketing/data/sample";

const loop = [
  "Connect GitHub",
  "Analyze merged PRs",
  "Reveal rank",
  "Unlock badges",
  "Complete quests",
  "Share profile",
];

export function LandingPage() {
  const { highlightedBadges, report, user } = marketingSample;

  return (
    <main className="space-y-8">
      <section className="glass-panel-strong panel-grid overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr,0.8fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              Open-source battle pass
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Turn open-source work into a reputation system.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-200/80 sm:text-lg">
                GitRank analyzes meaningful PR difficulty, review depth, tests, and project context, then turns that evidence into XP, levels, badges, and shareable profile snapshots.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/onboarding/connect-github">
                  Connect GitHub
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/leaderboard">Explore leaderboard</Link>
              </Button>
            </div>
            <p className="max-w-2xl text-sm text-muted">
              GitRank does not ask only how much you contributed. It asks what recent contribution evidence suggests about the work.
            </p>
          </div>
          <GlowCard strong className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs tracking-[0.24em] text-primary uppercase">Sample rank card</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{user.displayName}</h2>
              </div>
              <RankBadge rank={user.level.rankTier} />
            </div>
            <div className="flex items-center gap-4">
              <Image
                src={user.avatarUrl}
                alt={`${user.displayName} sample avatar`}
                width={72}
                height={72}
                className="h-[72px] w-[72px] rounded-3xl border border-white/10 bg-white/6"
              />
              <div className="space-y-1">
                <p className="text-sm text-muted">@{user.username}</p>
                <p className="text-3xl font-semibold text-white">Level {user.level.currentLevel}</p>
                <p className="text-sm text-slate-200">{user.title}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {user.strongestSignals.map((skill) => (
                <div key={skill} className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  {skill}
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {[
          {
            icon: <ChartNoAxesCombined className="h-5 w-5 text-primary" />,
            title: "GitHub graphs show activity, not skill.",
            text: "Commits, stars, and streaks ignore how hard the work was or whether it mattered.",
          },
          {
            icon: <GitPullRequestArrow className="h-5 w-5 text-primary" />,
            title: "PRs are not equal units of effort.",
            text: "A typo fix, a runtime bug fix, and a test-heavy recovery patch should never earn the same score.",
          },
          {
            icon: <ShieldCheck className="h-5 w-5 text-primary" />,
            title: "Meaningful work needs better evidence.",
            text: "GitRank weights merged outcomes, review depth, tests, impact, and repo context to resist spam.",
          },
        ].map((item) => (
          <GlowCard key={item.title} className="space-y-3">
            <div className="inline-flex rounded-2xl bg-white/6 p-3">{item.icon}</div>
            <h3 className="text-xl font-semibold text-white">{item.title}</h3>
            <p className="text-sm text-muted">{item.text}</p>
          </GlowCard>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
        <GlowCard className="space-y-5">
          <SectionHeader
            eyebrow="Solution"
            title="Reputation from evidence-backed contribution scoring"
            description="Merged PRs, changed files, review depth, tests, maintainers, and AI summaries feed into explainable score movement and inspectable profile snapshots."
          />
          <div className="grid gap-3">
            {[
              "Classifies documentation, tests, bug fixes, backend, infra, performance, and architecture work.",
              "Turns verified work into XP, badge unlocks, league position, and public proof.",
              "Explains score changes so maintainers and recruiters can inspect the evidence instead of trusting a black box.",
            ].map((line) => (
              <div key={line} className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {line}
              </div>
            ))}
          </div>
        </GlowCard>

        <GlowCard strong className="space-y-5">
          <SectionHeader
            eyebrow="Gamified loop"
            title="A serious progression loop"
            description="Structured like an RPG profile and battle pass, but disciplined enough for maintainers and hiring teams."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {loop.map((step, index) => (
              <div key={step} className="rounded-3xl border border-white/8 bg-white/5 p-4">
                <p className="text-xs tracking-[0.24em] text-primary uppercase">Step {index + 1}</p>
                <p className="mt-2 text-lg font-medium text-white">{step}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.08fr,0.92fr]">
        <GlowCard className="space-y-5">
          <SectionHeader
            eyebrow="Battle report"
            title="Every high-signal PR gets a post-match report"
            description="The scoring model stays visible. High XP only lands when the work had difficulty, context, review credibility, and clearly surfaced uncertainty."
          />
          <div className="rounded-[1.75rem] border border-white/8 bg-black/20 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">{report.owner}/{report.repo} #{report.number}</p>
                <h3 className="mt-2 text-xl font-semibold text-white">{report.title}</h3>
              </div>
              <div className="text-right">
                <p className="text-xs tracking-[0.24em] text-primary uppercase">{report.category}</p>
                <p className="mt-2 text-3xl font-semibold text-white">{report.xpEarned} XP</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Difficulty" value={report.difficultyScore} />
              <Metric label="Impact" value={report.impactScore} />
              <Metric label="Review depth" value={report.reviewDepthScore} />
            </div>
            <p className="mt-5 text-sm text-muted">{report.aiSummary}</p>
          </div>
        </GlowCard>

        <GlowCard className="space-y-5">
          <SectionHeader
            eyebrow="Badge shelf"
            title="Visible milestones, not vanity clutter"
            description="Badges are unlocked by sustained evidence. Legendary badges stay locked until the work deserves them."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {highlightedBadges.map((badge) => (
              <div key={badge.id} className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
                <RarityBadge rarity={badge.rarity} />
                <h3 className="mt-3 text-lg font-semibold text-white">{badge.name}</h3>
                <p className="mt-2 text-sm text-muted">{badge.description}</p>
              </div>
            ))}
          </div>
        </GlowCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <GlowCard className="space-y-4 border border-amber-400/18 bg-amber-400/6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-amber-100 uppercase">
            <Swords className="h-3.5 w-3.5" />
            Anti-spam promise
          </div>
          <h2 className="text-2xl font-semibold text-amber-50">Spam PRs do not make you powerful here.</h2>
          <p className="text-sm text-amber-50/80">
            Low-context noise, unreviewed changes, and thin contribution floods are scored down. Transparent scoring is the product, not a hidden trick.
          </p>
        </GlowCard>

        <GlowCard strong className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/12 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
              <Trophy className="h-3.5 w-3.5" />
              Ready to rank your work?
            </div>
            <h2 className="text-3xl font-semibold text-white">Build a profile that recruiters and maintainers can actually trust.</h2>
            <p className="max-w-2xl text-sm text-slate-200/80">The goal is a legible contribution snapshot, not an absolute ranking of developer worth.</p>
          </div>
          <Button asChild size="lg">
            <Link href="/onboarding/connect-github">Start the reveal</Link>
          </Button>
        </GlowCard>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
