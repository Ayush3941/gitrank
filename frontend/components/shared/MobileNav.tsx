"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Dashboard navigation mobile"
      className="mobile-nav-shell glass-panel cyber-card cyber-frame neon-outline fixed inset-x-3 z-40 grid grid-cols-5 gap-1.5 p-2 xl:hidden"
    >
      {dashboardNavItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "focus-ring flex min-h-14 flex-col items-center justify-center gap-1 border px-1.5 py-1.5 text-[11px] leading-none font-medium tracking-[0.01em] transition-colors",
              active
                ? "border-primary/44 bg-gradient-to-r from-primary/24 via-primary/16 to-primary-2/24 text-white shadow-[0_0_12px_rgb(34_226_255_/_0.18)]"
                : "border-transparent text-slate-200 hover:border-primary/26 hover:bg-primary/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.mobileLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
