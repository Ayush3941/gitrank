import type { ReactNode } from "react";
import { AppShell } from "@/components/shared/AppShell";
import { ArrowUpRight } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { Button } from "@/components/ui/button";

export function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-8">
        <header className="glass-panel cyber-card cyber-frame neon-outline px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <IntentPrefetchLink href="/" className="flex items-center gap-3">
              <div className="rounded-[var(--radius-universal)] border border-primary/24 bg-primary/14 p-2.5 text-primary ring-glow">
                <BrandLogo size={22} className="h-[22px] w-[22px]" priority />
              </div>
              <div>
                <p className="cyber-title text-lg font-semibold text-foreground">GitRank</p>
                <p className="hud-eyebrow text-xs font-semibold">Open-source reputation</p>
              </div>
            </IntentPrefetchLink>
            <div className="flex items-center gap-3">
              <Button asChild>
                <IntentPrefetchLink
                  href="/oauth/github/start?return_to=/dashboard"
                  prefetchMode="never"
                >
                  Connect GitHub
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </IntentPrefetchLink>
              </Button>
            </div>
          </div>
          <nav aria-label="Marketing routes" className="mt-4 border-t border-primary/14 pt-3">
            <ul
              role="list"
              className="dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide lane-rail flex gap-2 overflow-x-auto p-0.5 sm:flex-wrap sm:overflow-visible sm:p-0"
            >
              {[
                { href: "/#why-gitrank", label: "Why GitRank" },
                { href: "/#core-journeys", label: "Journeys" },
                { href: "/#battle-reports", label: "Reports" },
                { href: "/#start-reveal", label: "Start" },
              ].map((item) => (
                <li key={item.href} className="list-none shrink-0 sm:shrink">
                  <IntentPrefetchLink
                    href={item.href}
                    className="focus-ring dashboard-nav-item inline-flex min-h-11 items-center justify-center px-4 py-2 text-xs font-medium"
                  >
                    {item.label}
                  </IntentPrefetchLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        {children}
        <footer className="cyber-terminal px-5 py-6 text-sm text-muted">
          <p className="text-foreground">
            GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.
          </p>
        </footer>
      </div>
    </AppShell>
  );
}
