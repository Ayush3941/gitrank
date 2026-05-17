"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "gitrank:theme";
const CHANGE_EVENT = "gitrank:theme-preference";

const SUPPORTED_THEMES = ["neon", "midnight"] as const;

export type ThemePreference = (typeof SUPPORTED_THEMES)[number];

export function useThemePreference() {
  const theme = useSyncExternalStore(subscribe, getThemeSnapshot, () => "neon");

  const setTheme = useCallback((value: ThemePreference) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
    applyThemePreference(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { theme, setTheme };
}

export function useApplyThemePreference() {
  const { theme } = useThemePreference();

  useEffect(() => {
    applyThemePreference(theme);
  }, [theme]);
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getThemeSnapshot(): ThemePreference {
  if (typeof window === "undefined") {
    return "neon";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isThemePreference(stored)) {
    return stored;
  }
  return "neon";
}

function isThemePreference(value: string): value is ThemePreference {
  return SUPPORTED_THEMES.some((theme) => theme === value);
}

function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
}
