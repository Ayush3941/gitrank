"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "gitrank:theme";
const CHANGE_EVENT = "gitrank:theme-preference";
const HIGH_CONTRAST_QUERY = "(prefers-contrast: more)";

const SUPPORTED_THEMES = ["neon", "midnight", "terminal", "aurora", "high-contrast"] as const;

export type ThemePreference = (typeof SUPPORTED_THEMES)[number];
export type ThemePreferenceSource = "stored" | "system";

type ThemeSnapshot = {
  theme: ThemePreference;
  source: ThemePreferenceSource;
};

export function useThemePreference() {
  const theme = useSyncExternalStore<ThemePreference>(subscribe, getThemeSnapshot, () => "midnight");
  const themeSource = useSyncExternalStore<ThemePreferenceSource>(
    subscribe,
    getThemeSourceSnapshot,
    () => "system",
  );

  const setTheme = useCallback((value: ThemePreference) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
    applyThemePreference(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const clearThemePreference = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    const snapshot = getThemeSnapshotWithSource();
    applyThemePreference(snapshot.theme);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { theme, themeSource, setTheme, clearThemePreference };
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

  const contrastQuery = window.matchMedia(HIGH_CONTRAST_QUERY);
  const handleContrastChange = () => {
    window.dispatchEvent(new Event(CHANGE_EVENT));
    callback();
  };

  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  if (typeof contrastQuery.addEventListener === "function") {
    contrastQuery.addEventListener("change", handleContrastChange);
  } else if (typeof contrastQuery.addListener === "function") {
    contrastQuery.addListener(handleContrastChange);
  }
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
    if (typeof contrastQuery.removeEventListener === "function") {
      contrastQuery.removeEventListener("change", handleContrastChange);
    } else if (typeof contrastQuery.removeListener === "function") {
      contrastQuery.removeListener(handleContrastChange);
    }
  };
}

function getThemeSnapshot(): ThemePreference {
  return getThemeSnapshotWithSource().theme;
}

function getThemeSourceSnapshot(): ThemePreferenceSource {
  return getThemeSnapshotWithSource().source;
}

function isThemePreference(value: string): value is ThemePreference {
  return SUPPORTED_THEMES.some((theme) => theme === value);
}

function getThemeSnapshotWithSource(): ThemeSnapshot {
  if (typeof window === "undefined") {
    return { theme: "midnight", source: "system" };
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isThemePreference(stored)) {
    return { theme: stored, source: "stored" };
  }
  if (window.matchMedia(HIGH_CONTRAST_QUERY).matches) {
    return { theme: "high-contrast", source: "system" };
  }
  return { theme: "midnight", source: "system" };
}

function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
}
