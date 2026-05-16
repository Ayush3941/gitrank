"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Flag, LayoutDashboard, Settings, Shield, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/contributions", label: "Contributions", icon: Shield },
  { href: "/dashboard/badges", label: "Badges", icon: Award },
  { href: "/dashboard/quests", label: "Quests", icon: Flag },
  { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="glass-panel cyber-card cyber-frame panel-grid neon-outline hidden w-72 shrink-0 rounded-[2rem] p-5 xl:flex xl:flex-col xl:justify-between">
      <div className="space-y-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="cyber-sheen rounded-3xl bg-primary/16 p-3 text-primary ring-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="cyber-title text-lg font-semibold text-white">GitRank</p>
            <p className="hud-eyebrow text-xs font-semibold uppercase">Meaning over volume</p>
          </div>
        </Link>
        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                  active
                    ? "border-primary/45 bg-gradient-to-r from-primary/80 via-primary to-primary-2/80 text-background shadow-[0_0_26px_rgb(34_226_255_/_0.44)]"
                    : "border-transparent text-muted hover:border-primary/28 hover:bg-primary/12 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="cyber-terminal rounded-[1.75rem] p-4">
        <p className="text-xs font-semibold tracking-[0.24em] text-primary uppercase">Core thesis</p>
        <p className="cyber-copy mt-2 text-sm">
          GitRank does not ask only how much you contributed. It asks how meaningful your contribution was.
        </p>
      </div>
    </aside>
  );
}
