"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ThemePreference, useThemePreference } from "@/hooks/use-theme-preference";

const THEME_OPTIONS: Record<ThemePreference, { shortLabel: string; longLabel: string }> = {
  neon: { shortLabel: "Neon", longLabel: "Neon grid" },
  midnight: { shortLabel: "Midnight", longLabel: "Midnight contrast" },
  "high-contrast": { shortLabel: "Contrast", longLabel: "High contrast" },
};

const THEME_ORDER: ThemePreference[] = ["neon", "midnight", "high-contrast"];

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
      </Button>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusMessage}
      </span>
    </>
  );
}
