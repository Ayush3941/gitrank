"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight, FolderGit2, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import { emitAnalyticsEvent } from "@/lib/api/analytics-api";

export function ConnectGithubPanel() {
  const sentEventRef = useRef(false);

  useEffect(() => {
    if (sentEventRef.current) {
      return;
    }
    sentEventRef.current = true;
    void emitAnalyticsEvent({
      eventName: "onboarding.started",
      source: "frontend",
      target: "onboarding/connect-github",
      status: "success",
    });
  }, []);

  return (
    <main className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr,0.95fr]">
      <GlowCard strong className="space-y-6">
        <OnboardingStepper currentStep="connect" />
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <FolderGit2 className="h-3.5 w-3.5" />
          GitHub OAuth
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-white">Connect GitHub and let the scoring engine read your contribution history.</h1>
          <p className="max-w-2xl text-base leading-8 text-muted">
            We analyze public contribution evidence by default. Private code is not inspected unless you later choose to opt in.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            {
              step: "Step 1",
              title: "Authorize GitHub",
              text: "Sign in and approve read-only access for your contribution metadata.",
            },
            {
              step: "Step 2",
              title: "Sync evidence",
              text: "GitRank pulls recent merged PR, review, and repository context data.",
            },
            {
              step: "Step 3",
              title: "Reveal profile",
              text: "You land in the analyzing flow and unlock your first score snapshot.",
            },
          ].map((item) => (
            <li key={item.step} className="neon-surface space-y-2 rounded-3xl px-4 py-3 text-sm text-muted">
              <p className="text-xs font-medium text-primary">{item.step}</p>
              <p className="font-semibold text-white">{item.title}</p>
              <p className="text-xs leading-6 text-muted">{item.text}</p>
            </li>
          ))}
        </ol>
        <div className="neon-callout inline-flex items-center gap-2 px-3 py-2 text-xs text-cyan-100">
          <Timer className="h-4 w-4 text-cyan-200" />
          Typical first snapshot path: about 60-90 seconds after OAuth success.
        </div>
        <div className="space-y-3">
          <details className="neon-surface rounded-3xl px-4 py-3">
            <summary className="focus-ring inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-white">
              What data is read in v1
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              <li>Public profile basics and contribution activity.</li>
              <li>Merged PR metadata, review activity, and changed-file context.</li>
              <li>Repository visibility and recency signals used for scoring explanation.</li>
            </ul>
          </details>
          <details className="neon-surface rounded-3xl px-4 py-3">
            <summary className="focus-ring inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-white">
              What is not read by default
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              <li>Private repository code content in v1 baseline.</li>
              <li>Any hidden secrets from your local environment.</li>
              <li>Manual score overrides or admin-only edits.</li>
            </ul>
          </details>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/oauth/github/start?return_to=/onboarding/analyzing" prefetch={false}>
              Connect GitHub
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/onboarding/analyzing">Continue analyzing</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/">Back to landing</Link>
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
        <ul role="list" className="space-y-3">
          {[
            "Public profile can be disabled at any time.",
            "Exact PRs, AI summaries, and leaderboard participation are individually controllable.",
            "Repository-level visibility can be hidden without deleting the account.",
          ].map((item) => (
            <li key={item} className="neon-surface rounded-3xl px-4 py-3 text-sm text-muted">{item}</li>
          ))}
        </ul>
        <div className="neon-surface rounded-[1.75rem] border-primary/22 px-4 py-4">
          <p className="text-xs font-medium text-primary">Where this goes next</p>
          <p className="mt-2 text-sm text-slate-100">
            After OAuth, GitRank redirects to <span className="font-semibold text-white">Analyzing</span> and starts live sync. You will not see fabricated leaderboard identities during this flow.
          </p>
          <p className="mt-2 text-xs text-muted">
            If GitHub was already connected in this browser, you can skip OAuth and continue directly to Analyzing.
          </p>
        </div>
        <div className="rounded-[1.75rem] border border-primary/18 bg-primary/8 p-4 text-sm text-muted">
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
