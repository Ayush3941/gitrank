"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { GamificationQuickSwitcher } from "@/components/shared/GamificationQuickSwitcher";
import { TextScaleQuickSwitcher } from "@/components/shared/TextScaleQuickSwitcher";
import { ThemeQuickSwitcher } from "@/components/shared/ThemeQuickSwitcher";

export function DashboardSidebar() {
  const pathname = usePathname();

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeItem = dashboardNavItems.find((item) => isActive(item.href, item.exact));
  const ActiveLaneIcon = activeItem?.icon;

  return (
    <aside className="glass-panel cyber-card cyber-frame neon-outline hidden h-fit w-full shrink-0 p-4 xl:sticky sticky-safe-top-6 xl:flex xl:flex-col xl:justify-between">
      <div className="space-y-5">
        <Link
          href="/dashboard"
          prefetch={false}
          aria-label="Open dashboard home"
          className="focus-ring flex items-center gap-3 border border-primary/24 bg-gradient-to-r from-primary/10 to-primary-2/8 px-3 py-2.5"
        >
          <div className="bg-primary/16 p-2.5 text-primary ring-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="cyber-title break-anywhere text-base font-semibold text-white">GitRank</p>
            <p className="text-xs font-medium text-primary/92">Contributor Console</p>
          </div>
        </Link>
        <div className="neon-surface space-y-3 p-3.5">
          <p id="dashboard-sidebar-nav-label" className="cyber-title text-xs font-semibold text-cyan-100">
            Primary lanes
          </p>
          <p
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 border border-primary/22 bg-primary/10 px-2.5 py-1.5 text-xs text-cyan-100"
          >
            {ActiveLaneIcon ? <ActiveLaneIcon className="h-3.5 w-3.5 text-primary" /> : null}
            {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
          </p>
          <nav aria-labelledby="dashboard-sidebar-nav-label" className="space-y-2">
            <ul role="list" className="space-y-2">
              {dashboardNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href, item.exact);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch={false}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "focus-ring group relative grid min-h-14 grid-cols-[1.1rem,1fr] items-start gap-3 border px-3 py-2.5 text-sm leading-5",
                        active
                          ? "border-primary/40 bg-primary/12 text-white"
                          : "border-transparent text-foreground hover:border-primary/24 hover:bg-primary/8 hover:text-white",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-[2px] bg-transparent",
                          active && "bg-primary",
                        )}
                      />
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4",
                          active ? "text-primary" : "text-muted group-hover:text-primary",
                        )}
                      />
                      <span className="min-w-0 text-left">
                        <span className="block break-anywhere text-[0.95rem] font-semibold leading-5">{item.label}</span>
                        <span
                          className={cn(
                            "mt-0.5 block break-anywhere text-xs leading-5",
                            active ? "text-foreground" : "text-muted",
                          )}
                        >
                          {item.hint}
                        </span>
                      </span>
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
          <GamificationQuickSwitcher compact className="w-full justify-start" />
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
