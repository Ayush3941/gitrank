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
      className={cn(embedded ? "p-0.5" : "dashboard-nav-shell p-1.5")}
    >
      <ul
        role="list"
        className={cn(
          "dashboard-nav-track flex gap-1.5 overflow-x-auto p-0.5 pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0",
          embedded ? "sm:p-0" : "",
        )}
      >
        {dashboardNavItems.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <li key={item.href} className="list-none shrink-0 min-w-[8.75rem] sm:min-w-0">
              <Link
                href={item.href}
                prefetch={false}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring dashboard-nav-item inline-flex min-h-10 w-full items-center justify-start gap-2 px-3 py-2 text-left text-sm font-medium sm:justify-center sm:text-center",
                )}
                data-active={active ? "true" : "false"}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-current/90" aria-hidden="true" />
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
