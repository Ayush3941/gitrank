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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <IntentPrefetchLink href="/" className="flex items-center gap-3">
                <div className="rounded-3xl border border-primary/24 bg-primary/14 p-2.5 text-primary ring-glow">
                  <BrandLogo size={22} className="h-[22px] w-[22px]" priority />
                </div>
                <div>
                  <p className="cyber-title text-lg font-semibold text-foreground">GitRank</p>
                  <p className="hud-eyebrow text-xs font-semibold">Open-source reputation</p>
                </div>
              </IntentPrefetchLink>
              <nav aria-label="Marketing routes">
                <ul role="list" className="flex flex-wrap items-center gap-2">
                  {[
                    { href: "/#why-gitrank", label: "Why GitRank" },
                    { href: "/#core-journeys", label: "Journeys" },
                    { href: "/#battle-reports", label: "Reports" },
                    { href: "/#start-reveal", label: "Start" },
                  ].map((item) => (
                    <li key={item.href} className="list-none">
                      <IntentPrefetchLink
                        href={item.href}
                        className="focus-ring dashboard-nav-item inline-flex min-h-9 items-center justify-center px-3 py-1.5 text-xs font-medium"
                      >
                        {item.label}
                      </IntentPrefetchLink>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Button asChild>
                <IntentPrefetchLink
                  href="/oauth/github/start?return_to=/dashboard"
                  prefetchMode="never"
                >
                  Connect GitHub
                  <ArrowUpRight className="h-4 w-4" />
                </IntentPrefetchLink>
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
