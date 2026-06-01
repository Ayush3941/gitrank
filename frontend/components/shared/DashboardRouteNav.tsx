"use client";

import { usePathname } from "next/navigation";
import { useId } from "react";
import {
  Award,
  LayoutDashboard,
  Sparkles,
  Settings2,
  Swords,
  Waypoints,
} from "lucide-react";
import { dashboardNavItems, resolveDashboardNavItem } from "@/components/shared/dashboard-nav";
import { IntentPrefetchLink } from "@/components/shared/IntentPrefetchLink";
import { cn } from "@/lib/cn";

export function DashboardRouteNav({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const navId = useId();
  const activeLane = resolveDashboardNavItem(pathname);
  const isActive = (href: string) => activeLane.href === href;
  const iconByKey = {
    dashboard: LayoutDashboard,
    contributions: Waypoints,
    badges: Award,
    quests: Swords,
    settings: Settings2,
  } as const;
  const ActiveIcon = iconByKey[activeLane.icon];

  return (
    <nav
      aria-label="Dashboard routes"
      className={cn(embedded ? "p-0" : "dashboard-nav-shell p-1.5")}
    >
      <ul
        role="list"
        className={cn(
          "dashboard-nav-track grid grid-cols-2 gap-2 p-0.5 sm:grid-cols-5 sm:p-0",
        )}
      >
        {dashboardNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = iconByKey[item.icon];
          const descriptionId = `${navId}-${item.icon}-description`;
          return (
            <li key={item.href} className="list-none min-w-0">
              <IntentPrefetchLink
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                aria-describedby={descriptionId}
                title={item.description}
                className={cn(
                  "focus-ring dashboard-nav-item inline-flex min-h-11 w-full items-center justify-center px-3 py-2 text-center text-sm font-medium",
                )}
                data-active={active ? "true" : "false"}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Icon className="dashboard-nav-icon h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </span>
                <span id={descriptionId} className="sr-only">
                  {item.description}
                </span>
              </IntentPrefetchLink>
            </li>
          );
        })}
      </ul>
      <div className="dashboard-lane-caption mt-2.5 px-1.5 py-1.5" role="status" aria-live="polite" aria-atomic="true">
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span className="text-xs text-primary/95">Current lane</span>
        </span>
        <p className="mt-1.5 flex items-center gap-2 text-sm text-white">
          <ActiveIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="font-semibold text-white">{activeLane.label}</span>
          <span className="text-primary/70">•</span>
          <span className="text-muted">{activeLane.description}</span>
        </p>
      </div>
    </nav>
  );
}
