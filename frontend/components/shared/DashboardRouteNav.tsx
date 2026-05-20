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
      className="glass-panel"
    >
      <ul role="list" className="scrollbar-thin flex gap-2 overflow-x-auto p-2">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href} className="list-none">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring inline-flex min-h-10 items-center gap-2 border px-3 py-2 text-sm font-medium whitespace-nowrap",
                  active
                    ? "border-primary/42 bg-primary/14 text-white"
                    : "border-transparent text-foreground hover:border-primary/26 hover:bg-primary/10 hover:text-white",
                )}
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
