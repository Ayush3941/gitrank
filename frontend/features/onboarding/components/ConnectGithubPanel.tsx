"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FolderGit2, ShieldCheck, Sparkles } from "lucide-react";
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
            <div key={item} className="neon-surface rounded-3xl px-4 py-3 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <details className="neon-surface rounded-3xl px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-white">
              What data is read in v1
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200/84">
              <li>Public profile basics and contribution activity.</li>
              <li>Merged PR metadata, review activity, and changed-file context.</li>
              <li>Repository visibility and recency signals used for scoring explanation.</li>
            </ul>
          </details>
          <details className="neon-surface rounded-3xl px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-white">
              What is not read by default
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200/84">
              <li>Private repository code content in v1 baseline.</li>
              <li>Any hidden secrets from your local environment.</li>
              <li>Manual score overrides or admin-only edits.</li>
            </ul>
          </details>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/oauth/github/start?return_to=/onboarding/analyzing">Connect GitHub</Link>
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
        <div className="space-y-3">
          {[
            "Public profile can be disabled at any time.",
            "Exact PRs, AI summaries, and leaderboard participation are individually controllable.",
            "Repository-level visibility can be hidden without deleting the account.",
          ].map((item) => (
            <div key={item} className="neon-surface rounded-3xl px-4 py-3 text-sm text-slate-200">
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
