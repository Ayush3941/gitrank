"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, FolderGit2, ShieldCheck, Timer } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { GlowCard } from "@/components/shared/GlowCard";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";
import {
  CONNECT_DATA_NOT_READ_ROWS,
  CONNECT_DATA_READ_ROWS,
  CONNECT_GITHUB_STEPS,
  CONNECT_PRIVACY_CONTROLS,
} from "@/features/onboarding/lib/onboarding-entry-model";
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
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr,0.95fr]">
      <GlowCard strong className="space-y-6">
        <OnboardingStepper currentStep="connect" />
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
          <FolderGit2 className="h-3.5 w-3.5" aria-hidden="true" />
          GitHub OAuth
        </div>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight text-white">Connect GitHub and sync your contribution evidence.</h1>
          <p className="max-w-2xl text-base leading-8 text-muted">
            GitRank analyzes public contribution evidence by default. Private code is not inspected in v1.
          </p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {CONNECT_GITHUB_STEPS.map((item) => (
            <li key={item.id} className="neon-surface space-y-2 rounded-[var(--radius-universal)] px-4 py-3 text-sm text-muted">
              <p className="text-xs font-medium text-primary">{item.step}</p>
              <p className="font-semibold text-white">{item.title}</p>
              <p className="text-xs leading-6 text-muted">{item.text}</p>
            </li>
          ))}
        </ol>
        <div className="neon-callout inline-flex items-center gap-2 px-3 py-2 text-xs text-cyan-100">
          <Timer className="h-4 w-4 text-cyan-200" aria-hidden="true" />
          Typical first snapshot: about 60-90 seconds after OAuth success.
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
            <p className="text-xs font-medium text-primary">What data is read in v1</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              {CONNECT_DATA_READ_ROWS.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          </div>
          <div className="neon-surface rounded-[var(--radius-universal)] px-4 py-3">
            <p className="text-xs font-medium text-primary">What is not read by default</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
              {CONNECT_DATA_NOT_READ_ROWS.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <IntentPrefetchLink
              href="/oauth/github/start?return_to=/onboarding/analyzing"
              prefetchMode="never"
            >
              Connect GitHub
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </IntentPrefetchLink>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <IntentPrefetchLink href="/onboarding/analyzing">Continue analyzing</IntentPrefetchLink>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <IntentPrefetchLink href="/">Back to landing</IntentPrefetchLink>
          </Button>
        </div>
      </GlowCard>

      <GlowCard className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-[var(--radius-universal)] bg-emerald-400/12 p-3 text-emerald-200">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Privacy baseline</h2>
            <p className="text-sm text-muted">You control what becomes public.</p>
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">Privacy controls</h2>
          <ul role="list" className="space-y-3">
            {CONNECT_PRIVACY_CONTROLS.map((item) => (
              <li key={item.id} className="neon-surface rounded-[var(--radius-universal)] px-4 py-3 text-sm text-muted">{item.text}</li>
            ))}
          </ul>
        </div>
        <div className="neon-surface rounded-[var(--radius-universal)] border-primary/22 px-4 py-4">
          <p className="text-xs font-medium text-primary">Where this goes next</p>
          <p className="mt-2 text-sm text-foreground">
            After sign-in, GitRank redirects to <span className="font-semibold text-white">Analyzing</span> and starts GitHub App-backed sync.
          </p>
        </div>
        <div className="rounded-[var(--radius-universal)] border border-primary/18 bg-primary/8 p-4 text-sm text-muted">
          <div className="flex items-center gap-2 text-primary">
            <BrandLogo size={16} className="h-4 w-4" />
            Meaning-first scoring
          </div>
          <p className="mt-2">
            GitRank scores contribution quality, not only activity volume.
          </p>
        </div>
      </GlowCard>
    </div>
  );
}
