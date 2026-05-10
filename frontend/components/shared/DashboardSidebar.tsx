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
    <aside className="glass-panel hidden w-72 shrink-0 rounded-[2rem] p-5 xl:flex xl:flex-col xl:justify-between">
      <div className="space-y-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="rounded-3xl bg-primary/16 p-3 text-primary ring-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">GitRank</p>
            <p className="text-xs tracking-[0.24em] text-muted uppercase">Meaning over volume</p>
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
                  "focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  active
                    ? "bg-white text-background shadow-[0_10px_30px_rgb(255_255_255_/_0.1)]"
                    : "text-muted hover:bg-white/6 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="rounded-[1.75rem] border border-primary/20 bg-primary/10 p-4">
        <p className="text-xs font-semibold tracking-[0.24em] text-primary uppercase">Core thesis</p>
        <p className="mt-2 text-sm text-slate-200">
          GitRank does not ask only how much you contributed. It asks how meaningful your contribution was.
        </p>
      </div>
    </aside>
  );
}
