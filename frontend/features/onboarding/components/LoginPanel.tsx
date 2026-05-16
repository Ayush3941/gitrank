import Link from "next/link";
import { FolderGit2, LockKeyhole, Sparkles } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Button } from "@/components/ui/button";

export function LoginPanel({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const oauthURL = `/oauth/github/start?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <main className="mx-auto max-w-4xl">
      <GlowCard strong className="grid gap-6 lg:grid-cols-[1fr,0.9fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold tracking-[0.24em] text-primary uppercase">
            <LockKeyhole className="h-3.5 w-3.5" />
            Sign in
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">Enter GitRank and unlock a serious contribution profile.</h1>
          <p className="text-base leading-8 text-slate-200/80">
            GitRank feels like a battle pass, but the scoring model is built for maintainers, recruiters, and people who care whether the work mattered.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={oauthURL}>
                <FolderGit2 className="h-4 w-4" />
                Continue with GitHub
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/">Back to landing</Link>
            </Button>
          </div>
        </div>
        <GlowCard className="space-y-4">
          <div className="inline-flex rounded-3xl bg-primary/12 p-3 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold text-white">Meaning-first scoring</h2>
          <p className="text-sm text-muted">
            GitRank does not ask only how much you contributed. It asks how meaningful your contribution was.
          </p>
          <div className="grid gap-3">
            {[
              "Merged work outranks raw streaks.",
              "Review depth matters.",
              "Tests and repo context change XP.",
              "Spam PR floods get reduced multipliers.",
            ].map((line) => (
              <div key={line} className="neon-surface rounded-3xl px-4 py-3 text-sm text-slate-200">
                {line}
              </div>
            ))}
          </div>
        </GlowCard>
      </GlowCard>
    </main>
  );
}
