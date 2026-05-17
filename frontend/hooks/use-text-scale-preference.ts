"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "gitrank:text-scale";
const CHANGE_EVENT = "gitrank:text-scale-preference";
const SUPPORTED_TEXT_SCALES = ["default", "large"] as const;

export type TextScalePreference = (typeof SUPPORTED_TEXT_SCALES)[number];

export function useTextScalePreference() {
  const textScale = useSyncExternalStore(subscribe, getTextScaleSnapshot, () => "default");

  const setTextScale = useCallback((value: TextScalePreference) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value);
    applyTextScalePreference(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { textScale, setTextScale };
}

export function useApplyTextScalePreference() {
  const { textScale } = useTextScalePreference();

  useEffect(() => {
    applyTextScalePreference(textScale);
  }, [textScale]);
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

function getTextScaleSnapshot(): TextScalePreference {
  if (typeof window === "undefined") {
    return "default";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && isTextScalePreference(stored)) {
    return stored;
  }
  return "default";
}

function isTextScalePreference(value: string): value is TextScalePreference {
  return SUPPORTED_TEXT_SCALES.some((entry) => entry === value);
}

function applyTextScalePreference(value: TextScalePreference) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.textScale = value;
}
