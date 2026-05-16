"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Flag, LayoutDashboard, Settings, Shield } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard", label: "Dash", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/contributions", label: "PRs", icon: Shield },
  { href: "/dashboard/badges", label: "Badges", icon: Award },
  { href: "/dashboard/quests", label: "Quests", icon: Flag },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label="Dashboard navigation"
      className="glass-panel cyber-card cyber-frame neon-outline fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 p-1.5 xl:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring flex min-h-14 flex-col items-center justify-center gap-1 border px-1.5 py-1.5 text-[10px] font-medium tracking-[0.02em] transition-colors",
              active
                ? "border-primary/44 bg-gradient-to-r from-primary/26 via-primary/16 to-primary-2/24 text-white shadow-[0_0_14px_rgb(34_226_255_/_0.22)]"
                : "border-transparent text-muted hover:border-primary/26 hover:bg-primary/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
