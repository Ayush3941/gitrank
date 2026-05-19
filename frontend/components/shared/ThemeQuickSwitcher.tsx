"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ThemePreference, useThemePreference } from "@/hooks/use-theme-preference";

const THEME_OPTIONS: Record<ThemePreference, { shortLabel: string; longLabel: string }> = {
  neon: { shortLabel: "Neon", longLabel: "Neon grid" },
  midnight: { shortLabel: "Midnight", longLabel: "Midnight contrast" },
  aurora: { shortLabel: "Aurora", longLabel: "Aurora clarity" },
  "high-contrast": { shortLabel: "Contrast", longLabel: "High contrast" },
};

const THEME_SWATCHES: Record<ThemePreference, readonly [string, string, string]> = {
  neon: ["rgb(76,131,255)", "rgb(255,20,147)", "rgb(216,250,60)"],
  midnight: ["rgb(124,167,255)", "rgb(236,90,196)", "rgb(211,255,120)"],
  aurora: ["rgb(95,205,255)", "rgb(255,112,188)", "rgb(194,255,146)"],
  "high-contrast": ["rgb(104,181,255)", "rgb(255,120,206)", "rgb(254,230,90)"],
};

const THEME_ORDER: ThemePreference[] = ["neon", "midnight", "aurora", "high-contrast"];

export function ThemeQuickSwitcher({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useThemePreference();
  const [statusMessage, setStatusMessage] = useState("");
  const clearStatusTimeoutRef = useRef<number | null>(null);
  const currentIndex = THEME_ORDER.indexOf(theme);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextTheme = THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
  const current = THEME_OPTIONS[theme] ?? THEME_OPTIONS.midnight;
  const next = THEME_OPTIONS[nextTheme];
  const swatches = THEME_SWATCHES[theme] ?? THEME_SWATCHES.neon;

  useEffect(() => {
    return () => {
      if (clearStatusTimeoutRef.current !== null) {
        window.clearTimeout(clearStatusTimeoutRef.current);
      }
    };
  }, []);

  function handleSwitchTheme() {
    setTheme(nextTheme);
    setStatusMessage(`Theme changed to ${next.longLabel}.`);
    if (clearStatusTimeoutRef.current !== null) {
      window.clearTimeout(clearStatusTimeoutRef.current);
    }
    clearStatusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage("");
    }, 1200);
  }

  return (
    <>
      <Button
        type="button"
        size={compact ? "sm" : "md"}
        variant="secondary"
        className={className}
        title={`Theme: ${current.longLabel}. Switch to ${next.longLabel}. Shortcut: Alt+Shift+T.`}
        aria-label={`Theme ${current.longLabel}. Switch to ${next.longLabel}. Shortcut Alt Shift T.`}
        aria-keyshortcuts="Alt+Shift+T"
        onClick={handleSwitchTheme}
      >
        <Palette className="h-4 w-4 text-primary" />
        <span className="text-sm">
          Theme:
          {" "}
          <span className="font-semibold">{current.shortLabel}</span>
        </span>
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          {swatches.map((color, index) => (
            <span
              key={`${theme}-swatch-${index}`}
              className="h-2.5 w-2.5 border border-white/30"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
