import Link from "next/link";
import { FolderGit2, LockKeyhole, Sparkles } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";
import { Button } from "@/components/ui/button";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";

export function LoginPanel({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const oauthURL = `/oauth/github/start?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <main className="mx-auto max-w-4xl">
      <GlowCard strong className="grid gap-6 lg:grid-cols-[1fr,0.9fr]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <OnboardingStepper currentStep="sign-in" />
            <div className="flex flex-wrap gap-2">
              <ThemeQuickSwitcher compact />
              <TextScaleQuickSwitcher compact />
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <LockKeyhole className="h-3.5 w-3.5" />
            Sign in
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Sign in to unlock your GitRank profile.</h1>
          <p className="text-base leading-8 text-muted">
            Evidence-first scoring for meaningful merged work.
          </p>
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { step: "Step 1", text: "Sign in with GitHub OAuth." },
              { step: "Step 2", text: "GitRank syncs contribution evidence." },
              { step: "Step 3", text: "Open your dashboard and quests." },
            ].map((item) => (
              <li key={item.step} className="neon-surface space-y-2 rounded-3xl px-4 py-3 text-sm text-muted">
                <p className="text-xs font-medium text-primary">{item.step}</p>
                <p className="text-xs leading-6 text-muted">{item.text}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={oauthURL} prefetch={false}>
                <FolderGit2 className="h-4 w-4" />
                Continue with GitHub
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/" prefetch={false}>Back to landing</Link>
            </Button>
          </div>
        </div>
        <GlowCard className="space-y-4">
          <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold text-white">How scoring works</h2>
          <div className="space-y-3">
            <ul role="list" className="grid gap-3">
              {[
                "Merged work outranks streak volume.",
                "Review depth matters.",
                "Tests and repo context affect XP.",
                "Spam-like PR floods get reduced multipliers.",
              ].map((line, index) => (
                <li key={`score-rule-${index}-${line}`} className="neon-surface rounded-3xl px-4 py-3 text-sm text-muted">{line}</li>
              ))}
            </ul>
          </div>
        </GlowCard>
      </GlowCard>
    </main>
  );
}
