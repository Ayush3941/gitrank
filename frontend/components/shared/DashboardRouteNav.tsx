"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  LayoutDashboard,
  Settings2,
  Swords,
  Waypoints,
} from "lucide-react";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { cn } from "@/lib/cn";

export function DashboardRouteNav({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const iconByKey = {
    dashboard: LayoutDashboard,
    contributions: Waypoints,
    badges: Award,
    quests: Swords,
    settings: Settings2,
  } as const;

  return (
    <nav
      aria-label="Dashboard navigation"
      className={cn(embedded ? "p-0" : "dashboard-nav-shell p-1.5")}
    >
      <ul
        role="list"
        className={cn(
          "dashboard-nav-track grid grid-cols-2 gap-2 p-0.5 sm:grid-cols-5 sm:p-0",
        )}
      >
        {dashboardNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = iconByKey[item.icon];
          return (
            <li key={item.href} className="list-none min-w-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "focus-ring dashboard-nav-item inline-flex min-h-11 w-full items-center justify-center px-3 py-2 text-center text-sm font-medium",
                )}
                data-active={active ? "true" : "false"}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Icon className="dashboard-nav-icon h-4 w-4" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
