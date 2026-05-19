"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gauge, Palette, Type } from "lucide-react";
import { cn } from "@/lib/cn";
import { dashboardNavItems } from "@/components/shared/dashboard-nav";
import {
  useGamificationPreference,
  useNetworkConstraintPreference,
} from "@/hooks/use-gamification-preference";
import { useTextScalePreference } from "@/hooks/use-text-scale-preference";
import { useThemePreference, type ThemePreference } from "@/hooks/use-theme-preference";

const THEME_ORDER: ThemePreference[] = ["neon", "midnight", "aurora", "high-contrast"];

export function MobileNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const { reducedGamification, setReducedGamification } = useGamificationPreference();
  const constrainedNetwork = useNetworkConstraintPreference();
  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const activeItem = dashboardNavItems.find((item) => isActive(item.href, item.exact));
  const nextTheme = getNextTheme(theme);
  const nextTextScale = textScale === "large" ? "default" : "large";
  const nextReducedState = !reducedGamification;

  return (
    <nav
      aria-label="Dashboard navigation mobile"
      className="mobile-nav-shell glass-panel cyber-card cyber-frame neon-outline fixed inset-x-3 z-40 xl:hidden"
    >
      <p role="status" aria-live="polite" className="sr-only">
        {activeItem ? `Current lane: ${activeItem.label}` : "Dashboard navigation"}
      </p>
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
                  "focus-ring relative flex min-h-14 flex-col items-center justify-center gap-1 border px-1 py-2 text-[12px] leading-tight font-semibold",
                  active
                    ? "border-primary/42 bg-primary/14 text-white shadow-[0_0_14px_rgb(34_226_255_/_0.14)]"
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
                <span className="max-w-full break-anywhere text-center leading-4">{item.mobileLabel}</span>
                <span className="sr-only">{item.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-primary/18 px-1.5 pb-1.5 pt-1">
        <p className="sr-only">Quick display controls</p>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-1 border border-primary/24 bg-primary/8 px-2 py-2 text-xs font-semibold text-slate-100"
            aria-label={`Theme ${theme}. Switch to ${nextTheme}. Shortcut Alt Shift T.`}
            aria-keyshortcuts="Alt+Shift+T"
            title={`Theme: ${theme} → ${nextTheme}`}
          >
            <Palette className="h-3.5 w-3.5 text-primary" />
            Theme
          </button>
          <button
            type="button"
            onClick={() => setTextScale(nextTextScale)}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-1 border border-primary/24 bg-primary/8 px-2 py-2 text-xs font-semibold text-slate-100"
            aria-label={`Text size ${textScale}. Switch to ${nextTextScale}. Shortcut Alt Shift L.`}
            aria-keyshortcuts="Alt+Shift+L"
            title={`Text size: ${textScale} → ${nextTextScale}`}
          >
            <Type className="h-3.5 w-3.5 text-primary" />
            Text
          </button>
          <button
            type="button"
            onClick={() => setReducedGamification(nextReducedState)}
            className="focus-ring inline-flex min-h-11 items-center justify-center gap-1 border border-primary/24 bg-primary/8 px-2 py-2 text-xs font-semibold text-slate-100"
            aria-label={`Effects ${reducedGamification ? "reduced" : "full"}. Switch to ${nextReducedState ? "reduced" : "full"}. Shortcut Alt Shift G.`}
            aria-keyshortcuts="Alt+Shift+G"
            title={`Effects: ${reducedGamification ? "reduced" : "full"} → ${nextReducedState ? "reduced" : "full"}`}
          >
            <Gauge className="h-3.5 w-3.5 text-primary" />
            Effects
          </button>
        </div>
      </div>
    </nav>
  );
}

function getNextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}
