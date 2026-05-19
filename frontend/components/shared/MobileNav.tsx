"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import { useNetworkConstraintPreference } from "@/hooks/use-gamification-preference";

export function MobileNav() {
  const pathname = usePathname();
  const constrainedNetwork = useNetworkConstraintPreference();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeItem = dashboardNavItems.find((item) => isActive(item.href, item.exact));

  return (
    <nav
      aria-label="Dashboard navigation mobile"
      className="mobile-nav-shell glass-panel cyber-card cyber-frame neon-outline fixed inset-x-3 z-40 xl:hidden"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
      </p>
      <div className="flex items-center justify-between gap-2 border-b border-primary/16 px-3 pb-1.5 pt-2">
        <p className="min-w-0 text-xs text-cyan-100/90">
          {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
        </p>
        <Link
          href="/dashboard/settings#settings-display"
          prefetch={!constrainedNetwork}
          className="focus-ring inline-flex min-h-8 items-center justify-center border border-primary/20 bg-primary/8 px-2 text-[11px] font-semibold text-cyan-100 hover:border-primary/30 hover:text-white"
        >
          Display controls
        </Link>
      </div>
      <ul role="list" className="grid grid-cols-5 gap-1 p-1.5">
        {dashboardNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={!constrainedNetwork}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "focus-ring relative flex min-h-16 flex-col items-center justify-center gap-1 border px-1 py-1.5 text-xs leading-tight font-semibold",
                  active
                    ? "border-primary/42 bg-primary/14 text-white"
                    : "border-transparent text-slate-100 hover:border-primary/22 hover:bg-primary/8 hover:text-white",
                )}
              >
                <span
                  className={cn(
                    "absolute bottom-0 left-1/2 h-[2px] w-7 -translate-x-1/2 bg-transparent",
                    active && "bg-primary",
                  )}
                />
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-slate-200")} />
                <span className="max-w-[4.9rem] break-words text-center text-[11px] leading-4">{item.mobileLabel}</span>
                <span className="sr-only">{item.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
