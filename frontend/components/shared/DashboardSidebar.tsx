"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";

export function DashboardSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeItem = dashboardNavItems.find((item) => isActive(item.href, item.exact));

  return (
    <aside className="glass-panel cyber-card cyber-frame neon-outline hidden h-fit w-64 shrink-0 p-4 xl:sticky xl:top-6 xl:flex xl:flex-col xl:justify-between">
      <div className="space-y-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 border border-primary/24 bg-gradient-to-r from-primary/10 to-primary-2/8 px-3 py-2.5"
        >
          <div className="bg-primary/16 p-2.5 text-primary ring-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="cyber-title truncate text-base font-semibold text-white">GitRank</p>
            <p className="text-xs font-medium text-primary">Dashboard</p>
          </div>
        </Link>
        <div className="space-y-2">
          <p id="dashboard-sidebar-nav-label" className="cyber-title text-xs font-medium text-cyan-100">Navigate</p>
          <p
            role="status"
            aria-live="polite"
            className="text-xs text-cyan-100"
          >
            {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
          </p>
          <nav aria-labelledby="dashboard-sidebar-nav-label">
            <ul role="list" className="space-y-1.5">
              {dashboardNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring relative flex items-center gap-3 border px-3 py-2.5 text-sm leading-5 font-semibold",
                        active
                          ? "border-primary/45 bg-gradient-to-r from-primary/24 via-primary/16 to-primary-2/22 text-white shadow-[0_0_12px_rgb(34_226_255_/_0.14)]"
                          : "border-transparent text-slate-100 hover:border-primary/28 hover:bg-primary/10 hover:text-white",
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
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid gap-2">
          <ThemeQuickSwitcher compact className="w-full justify-start" />
          <TextScaleQuickSwitcher compact className="w-full justify-start" />
        </div>
        <div className="cyber-terminal p-3.5">
          <p className="text-xs font-semibold text-primary">Focus</p>
          <p className="cyber-copy mt-1.5 text-sm text-foreground">
            Meaningful contribution quality over raw activity volume.
          </p>
          <p className="mt-2 text-xs text-cyan-100">
            Quick actions: Ctrl/Cmd+K
          </p>
        </div>
      </div>
    </aside>
  );
}
