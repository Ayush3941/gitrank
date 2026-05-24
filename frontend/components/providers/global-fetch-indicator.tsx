"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import {
  useNetworkConstraintPreference,
  useReducedGamification,
} from "@/hooks/use-gamification-preference";

const SHOW_DELAY_MS = 220;
const MIN_VISIBLE_MS = 320;

export function GlobalFetchIndicator() {
  const reducedGamification = useReducedGamification();
  const constrainedNetwork = useNetworkConstraintPreference();
  const fetchCount = useIsFetching();
  const mutationCount = useIsMutating();
  const hasNetworkActivity = fetchCount + mutationCount > 0;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reducedGamification || constrainedNetwork) {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      shownAtRef.current = null;
      return;
    }

    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (hasNetworkActivity) {
      if (visible) {
        return;
      }
      showTimerRef.current = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
      return;
    }

    if (!visible) {
      return;
    }

    const shownAt = shownAtRef.current;
    const elapsed = shownAt ? Date.now() - shownAt : MIN_VISIBLE_MS;
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);

    hideTimerRef.current = setTimeout(() => {
      shownAtRef.current = null;
      setVisible(false);
    }, remaining);
  }, [constrainedNetwork, hasNetworkActivity, reducedGamification, visible]);

  useEffect(
    () => () => {
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
      }
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    },
    [],
  );

  return (
    visible && !reducedGamification && !constrainedNetwork ? (
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 bg-gradient-to-r from-primary via-primary-2 to-success shadow-[0_0_10px_rgb(34_226_255_/_0.24)]"
      />
    ) : null
  );
}
