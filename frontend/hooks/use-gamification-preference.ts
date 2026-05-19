"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ProfileViewData } from "@/types/gitrank";

const STORAGE_KEY = "gitrank:reduced-gamification";
const CHANGE_EVENT = "gitrank:gamification-preference";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const REDUCED_DATA_QUERY = "(prefers-reduced-data: reduce)";
const REDUCED_TRANSPARENCY_QUERY = "(prefers-reduced-transparency: reduce)";
const UPDATE_SLOW_QUERY = "(update: slow)";
const LOW_DEVICE_MEMORY_GB_THRESHOLD = 4;
const LOW_CPU_CORE_THRESHOLD = 4;

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
    addEventListener?: (type: "change", listener: () => void) => void;
    removeEventListener?: (type: "change", listener: () => void) => void;
  };
};

export type NetworkConstraintReason =
  | "save-data"
  | "slow-connection"
  | "reduced-data-preference"
  | "low-device-memory"
  | "low-cpu-cores"
  | "slow-display-updates";

export function useGamificationPreference() {
  const reducedGamification = useSyncExternalStore(
    subscribe,
    getReducedGamificationSnapshot,
    () => true,
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
  const { reducedGamification } = useGamificationPreference();
  return Boolean(reducedGamification);
}

export function useNetworkConstraintPreference() {
  const networkConstraintReason = useSyncExternalStore<NetworkConstraintReason | null>(
    subscribeNetworkConstraint,
    getNetworkConstraintReasonSnapshot,
    () => "reduced-data-preference",
  );
  return Boolean(networkConstraintReason);
}

export function useNetworkConstraintReason() {
  return useSyncExternalStore<NetworkConstraintReason | null>(
    subscribeNetworkConstraint,
    getNetworkConstraintReasonSnapshot,
    () => "reduced-data-preference",
  );
}

export function useApplyGamificationPreference() {
  const { reducedGamification } = useGamificationPreference();

  useEffect(() => {
    applyGamificationPreference(reducedGamification);
  }, [reducedGamification]);
}

export function useApplyNetworkConstraintPreference() {
  const networkConstraintReason = useNetworkConstraintReason();

  useEffect(() => {
    applyNetworkConstraintPreference(Boolean(networkConstraintReason), networkConstraintReason);
  }, [networkConstraintReason]);
}

export function useAccountGamificationPreference(profile?: ProfileViewData | null) {
  const { setReducedGamification } = useGamificationPreference();
  const accountReducedGamification = profile?.user.privacy.reducedGamification;

  useEffect(() => {
    if (accountReducedGamification === undefined) {
      return;
    }
    setReducedGamification(accountReducedGamification);
  }, [accountReducedGamification, setReducedGamification]);
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQueries = [
    window.matchMedia(REDUCED_MOTION_QUERY),
    window.matchMedia(REDUCED_DATA_QUERY),
    window.matchMedia(REDUCED_TRANSPARENCY_QUERY),
    window.matchMedia(UPDATE_SLOW_QUERY),
  ];
  const connection = (window.navigator as NavigatorWithConnection).connection;
  const handleMediaChange = () => {
    window.dispatchEvent(new Event(CHANGE_EVENT));
    callback();
  };

  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  for (const mediaQuery of mediaQueries) {
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleMediaChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleMediaChange);
    }
  }
  if (typeof connection?.addEventListener === "function") {
    connection.addEventListener("change", handleMediaChange);
  }
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
    for (const mediaQuery of mediaQueries) {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", handleMediaChange);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(handleMediaChange);
      }
    }
    if (typeof connection?.removeEventListener === "function") {
      connection.removeEventListener("change", handleMediaChange);
    }
  };
}

function getReducedGamificationSnapshot() {
  if (typeof window === "undefined") {
    return true;
  }

  const storedPreference = window.localStorage.getItem(STORAGE_KEY);
  if (storedPreference === "true") {
    return true;
  }
  if (storedPreference === "false") {
    return false;
  }

  return inferReducedGamificationPreference();
}

function applyGamificationPreference(reduced: boolean) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.gamification = reduced ? "reduced" : "full";
  const networkConstraintReason = inferNetworkConstraintReason();
  applyNetworkConstraintPreference(Boolean(networkConstraintReason), networkConstraintReason);
}

function applyNetworkConstraintPreference(
  constrained: boolean,
  reason: NetworkConstraintReason | null = null,
) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.network = constrained ? "constrained" : "default";
  if (reason) {
    document.documentElement.dataset.networkReason = reason;
    return;
  }
  delete document.documentElement.dataset.networkReason;
}

function subscribeNetworkConstraint(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const reducedDataQuery = window.matchMedia(REDUCED_DATA_QUERY);
  const slowUpdateQuery = window.matchMedia(UPDATE_SLOW_QUERY);
  const connection = (window.navigator as NavigatorWithConnection).connection;
  const handleChange = () => callback();

  if (typeof reducedDataQuery.addEventListener === "function") {
    reducedDataQuery.addEventListener("change", handleChange);
  } else if (typeof reducedDataQuery.addListener === "function") {
    reducedDataQuery.addListener(handleChange);
  }
  if (typeof slowUpdateQuery.addEventListener === "function") {
    slowUpdateQuery.addEventListener("change", handleChange);
  } else if (typeof slowUpdateQuery.addListener === "function") {
    slowUpdateQuery.addListener(handleChange);
  }
  if (typeof connection?.addEventListener === "function") {
    connection.addEventListener("change", handleChange);
  }

  return () => {
    if (typeof reducedDataQuery.removeEventListener === "function") {
      reducedDataQuery.removeEventListener("change", handleChange);
    } else if (typeof reducedDataQuery.removeListener === "function") {
      reducedDataQuery.removeListener(handleChange);
    }
    if (typeof slowUpdateQuery.removeEventListener === "function") {
      slowUpdateQuery.removeEventListener("change", handleChange);
    } else if (typeof slowUpdateQuery.removeListener === "function") {
      slowUpdateQuery.removeListener(handleChange);
    }
    if (typeof connection?.removeEventListener === "function") {
      connection.removeEventListener("change", handleChange);
    }
  };
}

function getNetworkConstraintReasonSnapshot() {
  if (typeof window === "undefined") {
    return "reduced-data-preference" as NetworkConstraintReason;
  }
  return inferNetworkConstraintReason();
}

export function inferReducedGamificationPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  if (inferNetworkConstraintReason()) {
    return true;
  }

  return (
    window.matchMedia(REDUCED_MOTION_QUERY).matches ||
    window.matchMedia(REDUCED_TRANSPARENCY_QUERY).matches
  );
}

export function inferNetworkConstraintReason(): NetworkConstraintReason | null {
  if (typeof window === "undefined") {
    return "reduced-data-preference";
  }

  const navigatorWithConnection = window.navigator as NavigatorWithConnection;
  const connection = navigatorWithConnection.connection;
  if (connection?.saveData === true) {
    return "save-data";
  }
  if (connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g") {
    return "slow-connection";
  }
  if (window.matchMedia(REDUCED_DATA_QUERY).matches) {
    return "reduced-data-preference";
  }
  if (window.matchMedia(UPDATE_SLOW_QUERY).matches) {
    return "slow-display-updates";
  }
  if (
    typeof navigatorWithConnection.deviceMemory === "number" &&
    navigatorWithConnection.deviceMemory <= LOW_DEVICE_MEMORY_GB_THRESHOLD
  ) {
    return "low-device-memory";
  }
  if (
    typeof window.navigator.hardwareConcurrency === "number" &&
    window.navigator.hardwareConcurrency <= LOW_CPU_CORE_THRESHOLD
  ) {
    return "low-cpu-cores";
  }
  return null;
}
