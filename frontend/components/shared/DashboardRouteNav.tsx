"use client";

import { usePathname } from "next/navigation";
import { useId } from "react";
import {
  Award,
  LayoutDashboard,
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
  return (
    <nav
      aria-label="Dashboard routes"
      className={cn(embedded ? "p-0" : "dashboard-nav-shell p-1.5")}
    >
      <ul
        role="list"
        className={cn(
          "dashboard-nav-track scroll-fade-x scroll-fade-x-sm-hide lane-rail flex gap-2 overflow-x-auto p-0.5 sm:grid sm:grid-cols-5 sm:overflow-visible sm:p-0",
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
                  "focus-ring dashboard-nav-item inline-flex min-h-11 w-full min-w-[9.5rem] items-center justify-center px-3 py-2 text-center text-sm font-medium sm:min-w-0",
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
    </nav>
  );
}
