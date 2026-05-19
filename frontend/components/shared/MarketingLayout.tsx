import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-8">
        <header className="glass-panel cyber-card cyber-frame neon-outline flex items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-3xl bg-primary/16 p-3 text-primary ring-glow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="cyber-title text-lg font-semibold text-white">GitRank</p>
              <p className="hud-eyebrow text-xs font-semibold">Open-source reputation</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button asChild>
              <Link href="/oauth/github/start?return_to=/dashboard" prefetch={false}>
                Connect GitHub
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>
        {children}
        <footer className="cyber-terminal px-5 py-6 text-sm text-muted">
          <p>GitRank rewards merged evidence, review depth, tests, and project impact. Spam PRs do not make you powerful here.</p>
        </footer>
      </div>
    </AppShell>
  );
}
