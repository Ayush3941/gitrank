"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "gitrank:display-shortcuts-enabled";
const CHANGE_EVENT = "gitrank:display-shortcuts-enabled-change";

export function useDisplayShortcutsEnabled() {
  const enabled = useSyncExternalStore(subscribe, getEnabledSnapshot, () => true);

  const setEnabled = useCallback((value: boolean) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return {
    enabled,
    setEnabled,
  };
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

function getEnabledSnapshot() {
  if (typeof window === "undefined") {
    return true;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "false") {
    return false;
  }
  return true;
}
