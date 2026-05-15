import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-8">
        <header className="glass-panel cyber-card panel-grid neon-outline flex items-center justify-between rounded-[2rem] px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-3xl bg-primary/16 p-3 text-primary ring-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">GitRank</p>
              <p className="hud-eyebrow text-xs font-semibold uppercase">Open-source reputation</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/leaderboard">Leaderboard</Link>
            </Button>
            <Button asChild>
              <Link href="/onboarding/connect-github">
                Connect GitHub
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>
        {children}
        <footer className="neon-surface panel-grid rounded-[1.75rem] px-5 py-6 text-sm text-muted">
          <p>GitRank rewards merged evidence, review depth, tests, and project impact. Spam PRs do not make you powerful here.</p>
        </footer>
      </div>
    </AppShell>
  );
}
