import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/shared/AppShell";
import { Button } from "@/components/ui/button";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-8">
        <header className="glass-panel cyber-card cyber-frame neon-outline px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <div className="rounded-3xl bg-primary/16 p-3 text-primary ring-glow">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="cyber-title text-lg font-semibold text-foreground">GitRank</p>
                  <p className="hud-eyebrow text-xs font-semibold">Open-source reputation</p>
                </div>
              </Link>
              <nav aria-label="Marketing routes">
                <ul role="list" className="flex flex-wrap items-center gap-2">
                  {[
                    { href: "/#why-gitrank", label: "Why GitRank" },
                    { href: "/#core-journeys", label: "Journeys" },
                    { href: "/#battle-reports", label: "Reports" },
                    { href: "/#start-reveal", label: "Start" },
                  ].map((item) => (
                    <li key={item.href} className="list-none">
                      <Link
                        href={item.href}
                        prefetch={false}
                        className="focus-ring dashboard-nav-item inline-flex min-h-9 items-center justify-center px-3 py-1.5 text-xs font-medium"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild>
                <Link href="/oauth/github/start?return_to=/dashboard" prefetch={false}>
                  Connect GitHub
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </header>
        {children}
        <footer className="cyber-terminal px-5 py-6 text-sm text-muted">
          <p className="text-foreground">
            GitRank rewards merged evidence, review depth, tests, and project impact. Spam PRs do not make you powerful here.
          </p>
        </footer>
      </div>
    </AppShell>
  );
}
