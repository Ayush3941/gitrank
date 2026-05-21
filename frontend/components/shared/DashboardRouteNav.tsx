"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { cn } from "@/lib/cn";

export function DashboardRouteNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Dashboard navigation"
      className="dashboard-nav-shell p-1.5 [overflow-anchor:none]"
    >
      <ul role="list" className="dashboard-nav-track scrollbar-thin flex gap-1.5 overflow-x-auto p-0.5">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href} className="dashboard-nav-snap list-none">
              <Link
                href={item.href}
                prefetch={false}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring dashboard-nav-item inline-flex min-h-10 items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                )}
                data-active={active ? "true" : "false"}
                title={item.hint}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted")} />
                <span className="sm:hidden">{item.mobileLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
