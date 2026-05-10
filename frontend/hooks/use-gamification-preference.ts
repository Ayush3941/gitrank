"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useReducedMotion } from "motion/react";

const STORAGE_KEY = "gitrank:reduced-gamification";
const CHANGE_EVENT = "gitrank:gamification-preference";

export function useGamificationPreference() {
  const reducedGamification = useSyncExternalStore(
    subscribe,
    getReducedGamificationSnapshot,
    () => false,
  );

  const setReducedGamification = useCallback((value: boolean) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    applyGamificationPreference(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { reducedGamification, setReducedGamification };
}

export function useReducedGamification() {
  const prefersReducedMotion = useReducedMotion();
  const { reducedGamification } = useGamificationPreference();
  return Boolean(prefersReducedMotion || reducedGamification);
}

export function useApplyGamificationPreference() {
  const { reducedGamification } = useGamificationPreference();

  useEffect(() => {
    applyGamificationPreference(reducedGamification);
  }, [reducedGamification]);
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

function getReducedGamificationSnapshot() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

function applyGamificationPreference(reduced: boolean) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.gamification = reduced ? "reduced" : "full";
}
