"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { cn } from "@/lib/cn";

export function DashboardRouteNav({ embedded = false }: { embedded?: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Dashboard navigation"
      className={cn(embedded ? "p-0" : "dashboard-nav-shell p-1.5")}
    >
      <ul
        role="list"
        className={cn(
          "dashboard-nav-track scrollbar-thin flex gap-1.5 overflow-x-auto p-0.5",
          embedded ? "sm:p-0.5" : "",
        )}
      >
        {dashboardNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href} className="list-none shrink-0 min-[440px]:min-w-[8.25rem] sm:min-w-0 sm:flex-1">
              <Link
                href={item.href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring dashboard-nav-item inline-flex min-h-10 w-full items-center justify-center gap-2 px-3 py-2 text-center text-sm font-medium",
                )}
                data-active={active ? "true" : "false"}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-current/90" aria-hidden="true" />
                <span className="truncate sm:hidden">{item.mobileLabel}</span>
                <span className="hidden truncate sm:inline">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
