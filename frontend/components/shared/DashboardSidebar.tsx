"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Flag, LayoutDashboard, Settings, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contributions", label: "Contributions", icon: Shield },
  { href: "/dashboard/badges", label: "Badges", icon: Award },
  { href: "/dashboard/quests", label: "Quests", icon: Flag },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside className="glass-panel cyber-card cyber-frame neon-outline hidden h-fit w-64 shrink-0 p-4 xl:sticky xl:top-6 xl:flex xl:flex-col xl:justify-between">
      <div className="space-y-6">
        <Link href="/dashboard" className="flex items-center gap-3 border border-primary/18 bg-primary/6 px-3 py-2.5">
          <div className="cyber-sheen bg-primary/16 p-2.5 text-primary ring-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="cyber-title truncate text-base font-semibold text-white">GitRank</p>
            <p className="text-[10px] tracking-[0.22em] text-primary uppercase">Dashboard</p>
          </div>
        </Link>
        <nav aria-label="Dashboard navigation" className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring relative flex items-center gap-3 border px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary/42 bg-gradient-to-r from-primary/26 via-primary/16 to-primary-2/24 text-white shadow-[0_0_18px_rgb(34_226_255_/_0.28)]"
                    : "border-transparent text-muted hover:border-primary/28 hover:bg-primary/10 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-[2px] bg-transparent",
                    active && "bg-primary",
                  )}
                />
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="cyber-terminal mt-6 p-3.5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-primary uppercase">Focus</p>
        <p className="cyber-copy mt-1.5 text-xs text-foreground/84">
          Meaningful contribution quality over raw activity volume.
        </p>
      </div>
    </aside>
  );
}
