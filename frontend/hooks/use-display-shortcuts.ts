"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTextScalePreference } from "@/hooks/use-text-scale-preference";
import { useThemePreference, type ThemePreference } from "@/hooks/use-theme-preference";

const THEME_ORDER: ThemePreference[] = ["neon", "midnight", "aurora", "high-contrast"];

export function useDisplayShortcutsStatus(enabled: boolean) {
  const { theme, setTheme } = useThemePreference();
  const { textScale, setTextScale } = useTextScalePreference();
  const [statusMessage, setStatusMessage] = useState("");
  const clearStatusTimeoutRef = useRef<number | null>(null);
  const queueStatusMessage = useCallback((message: string) => {
    setStatusMessage(message);
    if (clearStatusTimeoutRef.current !== null) {
      window.clearTimeout(clearStatusTimeoutRef.current);
    }
    clearStatusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage("");
    }, 1400);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.altKey || !event.shiftKey || event.metaKey || event.ctrlKey) {
        return;
      }
      if (event.repeat) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "t") {
        event.preventDefault();
        const nextTheme = getNextTheme(theme);
        setTheme(nextTheme);
        queueStatusMessage(`Theme changed to ${labelForTheme(nextTheme)}.`);
        return;
      }

      if (key === "l") {
        event.preventDefault();
        const nextTextScale = textScale === "large" ? "default" : "large";
        setTextScale(nextTextScale);
        queueStatusMessage(
          `Text size changed to ${nextTextScale === "large" ? "Large text" : "Default text"}.`,
        );
      }
    }

    if (!enabled) {
      return;
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (clearStatusTimeoutRef.current !== null) {
        window.clearTimeout(clearStatusTimeoutRef.current);
      }
    };
  }, [enabled, queueStatusMessage, setTextScale, setTheme, textScale, theme]);

  return statusMessage;
}

function getNextTheme(current: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(current);
  const safeIndex = index >= 0 ? index : 0;
  return THEME_ORDER[(safeIndex + 1) % THEME_ORDER.length];
}

function labelForTheme(theme: ThemePreference): string {
  if (theme === "neon") {
    return "Neon grid";
  }
  if (theme === "high-contrast") {
    return "High contrast";
  }
  if (theme === "aurora") {
    return "Aurora clarity";
  }
  return "Midnight contrast";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  const closestEditable = target.closest(
    "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox'], [aria-multiline='true']",
  );
  return Boolean(closestEditable);
}
