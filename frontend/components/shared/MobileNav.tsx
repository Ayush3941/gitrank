"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Flag, LayoutDashboard, Settings, Shield, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/contributions", label: "PRs", icon: Shield },
  { href: "/dashboard/badges", label: "Badges", icon: Award },
  { href: "/dashboard/quests", label: "Quests", icon: Flag },
  { href: "/dashboard/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="glass-panel cyber-card fixed inset-x-4 bottom-4 z-40 grid grid-cols-6 gap-1 rounded-[2rem] p-2 xl:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "focus-ring flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition",
              active
                ? "bg-gradient-to-r from-primary via-primary-2 to-primary text-background shadow-[0_0_20px_rgb(34_226_255_/_0.42)]"
                : "text-muted hover:bg-primary/12",
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
