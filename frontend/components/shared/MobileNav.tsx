"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeItem = dashboardNavItems.find((item) => isActive(item.href, item.exact));

  return (
    <nav
      aria-label="Dashboard navigation mobile"
      className="mobile-nav-shell dashboard-nav-shell xl:hidden"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
      </p>
      <ul role="list" className="scrollbar-thin flex snap-x gap-1.5 overflow-x-auto px-2 pb-2 pt-1.5">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href} className="min-w-[6.4rem] flex-1 snap-start">
              <Link
                href={item.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "focus-ring dashboard-nav-item relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 px-2 py-2 text-[0.84rem] leading-tight font-semibold",
                )}
                data-active={active ? "true" : "false"}
              >
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 h-[2px] w-8 -translate-x-1/2 bg-transparent",
                    active && "bg-primary",
                  )}
                />
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted")} />
                <span className="max-w-[6rem] break-anywhere text-center text-[0.84rem] leading-4">{item.mobileLabel}</span>
                <span className="sr-only">{item.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
