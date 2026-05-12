import Link from "next/link";
import { FolderGit2, ShieldCheck, Sparkles } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export function ConnectGithubPanel() {
  return (
    <main className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr,0.95fr]">
      <GlowCard strong className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
          <FolderGit2 className="h-3.5 w-3.5" />
          GitHub OAuth
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-white">Connect GitHub and let the scoring engine read your contribution history.</h1>
          <p className="max-w-2xl text-base leading-8 text-slate-200/80">
            We analyze public contribution evidence by default. Private code is not inspected unless you later choose to opt in.
          </p>
        </div>
        <div className="grid gap-3">
          {[
            "Read public profile metadata and contribution history.",
            "Inspect merged PRs, reviews, changed files, linked issues, and repository context.",
            "Build an explainable score instead of a raw activity count.",
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/onboarding/analyzing">Connect GitHub</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/leaderboard">Explore leaderboard first</Link>
          </Button>
        </div>
      </GlowCard>

      <GlowCard className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-3xl bg-emerald-400/12 p-3 text-emerald-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Privacy baseline</h2>
            <p className="text-sm text-muted">You control what becomes public later.</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            "Public profile can be disabled at any time.",
            "Exact PRs, AI summaries, and leaderboard participation are individually controllable.",
            "Repository-level visibility can be hidden without deleting the account.",
          ].map((item) => (
            <div key={item} className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
        <div className="rounded-[1.75rem] border border-primary/18 bg-primary/8 p-4 text-sm text-slate-200">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            Meaning-first scoring
          </div>
          <p className="mt-2">
            GitRank does not ask only how much you contributed. It asks how meaningful your contribution was.
          </p>
        </div>
      </GlowCard>
    </main>
  );
}
