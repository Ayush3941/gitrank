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
      className="mobile-nav-shell glass-panel cyber-card cyber-frame neon-outline fixed inset-x-3 z-40 grid grid-cols-5 gap-1.5 p-2.5 xl:hidden"
    >
      <p
        role="status"
        aria-live="polite"
        className="col-span-5 px-1 text-xs font-medium text-cyan-100"
      >
        {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
      </p>
      <ul role="list" className="col-span-5 grid grid-cols-5 gap-1.5">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "focus-ring relative flex min-h-14 flex-col items-center justify-center gap-1 border px-1.5 py-1.5 text-[11px] leading-none font-semibold tracking-[0.02em]",
                  active
                    ? "border-primary/46 bg-gradient-to-r from-primary/26 via-primary/18 to-primary-2/24 text-white shadow-[0_0_10px_rgb(34_226_255_/_0.13)]"
                    : "border-transparent text-slate-100 hover:border-primary/26 hover:bg-primary/10 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0 left-1/2 h-[2px] w-6 -translate-x-1/2 bg-transparent",
                    active && "bg-primary",
                  )}
                />
                <Icon className="h-4 w-4" />
                <span>{item.mobileLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
